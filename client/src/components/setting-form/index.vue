<script setup lang="ts">
import { ref, computed, watch, toRaw, onMounted } from "vue"
import { bitable } from "@lark-base-open/js-sdk"
import type { ITableMeta } from "@lark-base-open/js-sdk"
import { importModes, UpdateMode } from "@/types/types"
import type { ExcelDataInfo, fieldMap, ImportOptions, VirtualIndexField, IndexFieldConfig } from "@/types/types"
import { ElMessage, type TableColumnCtx, type UploadFile } from "element-plus"
import {
  Setting,
  Lock,
  Refresh,
  Key,
  EditPen,
  DeleteFilled,
  Link,
} from "@element-plus/icons-vue"
import { indexFieldType, Log, Error, Warn, downLoadFileFromA } from "@/utils"
import fieldSetting from "@/components/field-setting/index.vue"
import linkSetting from "@/components/link-setting/index.vue"
import concatSetting from "@/components/concat-setting/index.vue"
import { useI18n } from "vue-i18n"
import fieldIcon from "@/components/field-icon/index.vue"
import importInfo from "@/components/import-info/index.vue"
import { useSetting } from "./composables"
import { useSelection, useTable, useFieldMetaList } from "@qww0302/use-bitable"
import { cellTranslator } from "@/utils/cellValue"
import { useStorage } from "@vueuse/core"
import defaultOptions from "~/plugin.config.json"
import { validateIndex, validateIndexAuto } from "./utils"
import ExportIcon from "@/components/icons/export-icon.vue"
import ImportIcon from "@/components/icons/import-icon.vue"
import { Tools } from "@element-plus/icons-vue"
import type { ConcatConfig } from "@/types/types"
import virtualIndexSetting from "@/components/virtual-index-setting/index.vue"

const { t } = useI18n()
const props = defineProps({
  excelData: {
    type: Object as () => ExcelDataInfo,
    default: undefined,
  },
  onImported: {
    type: Function as () => () => void,
    default: undefined,
  },
})
const modeSelect = ref(["append"])
const form = ref()
const chooseRef = ref()
const settingRef = ref()
const importInfoRef = ref()
const linkRef = ref()
const concatRef = ref()
const currentConcatField = ref<fieldMap>()
const virtualIndexRef = ref()
const virtualIndexFields = ref<VirtualIndexField[]>([])

// 索引字段配置（用于合并模式）
const indexFieldConfigs = ref<Map<string, IndexFieldConfig>>(new Map())
const currentIndexConfig = ref<IndexFieldConfig | null>(null)
const showIndexConfigDialog = ref(false)
const currentEditingFieldId = ref<string>("")
const tableList = ref<ITableMeta[]>([])
const targetTableId = ref<string>("")
const allowAdd = ref(true)
const AllowActionValue: Record<string, ImportOptions["allowAction"]> = {
  updateAndAdd: {
    add: true,
    update: true,
    delete: true,
  },
  onlyAdd: {
    add: true,
    update: false,
    delete: false,
  },
  onlyUpdate: {
    add: false,
    update: true,
    delete: true,
  },
}

enum AllowAction {
  updateAndAdd = "updateAndAdd",
  onlyAdd = "onlyAdd",
  onlyUpdate = "onlyUpdate",
}

const userId = ref<string>(await bitable.bridge.getUserId())
const userOptions = useStorage<ImportOptions>(
  `Excel_Compare_and_import-${userId.value}`,
  defaultOptions,
  undefined,
  {
    mergeDefaults: true,
  },
)
const getAllowAction = (actions: ImportOptions["allowAction"]) => {
  if (!actions) return AllowAction.updateAndAdd
  if (actions.add && actions.update && actions.delete) {
    return AllowAction.updateAndAdd
  }
  if (actions.add && !actions.update && !actions.delete) {
    return AllowAction.onlyAdd
  }
  if (!actions.add && actions.update && actions.delete) {
    return AllowAction.onlyUpdate
  }
  return AllowAction.updateAndAdd
}
const allowAction = ref<AllowAction>(
  getAllowAction(userOptions.value.allowAction),
)
const changeAllowAction = (value: any) => {
  userOptions.value.allowAction = AllowActionValue[value]
}

const updateOptionSelector = () => [
  {
    value: UpdateMode.SAVE_MOST,
    label: t("updateMode.saveMost"),
    children: [
      {
        value: UpdateMode.SAVE_LATEST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveLatest"),
      },
      {
        value: UpdateMode.SAVE_OLDEST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveOldest"),
      },
    ],
  },
  {
    value: UpdateMode.SAVE_LEAST,
    label: t("updateMode.saveLeast"),
    children: [
      {
        value: UpdateMode.SAVE_LATEST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveLatest"),
      },
      {
        value: UpdateMode.SAVE_OLDEST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveOldest"),
      },
    ],
  },
  {
    value: UpdateMode.SAVE_LATEST,
    label: t("updateMode.saveLatest"),
    children: [
      {
        value: UpdateMode.SAVE_MOST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveMost"),
      },
      {
        value: UpdateMode.SAVE_LEAST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveLeast"),
      },
    ],
  },
  {
    value: UpdateMode.SAVE_OLDEST,
    label: t("updateMode.saveOldest"),
    children: [
      {
        value: UpdateMode.SAVE_MOST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveMost"),
      },
      {
        value: UpdateMode.SAVE_LEAST,
        label: t("updateMode.whenLastSame") + t("updateMode.saveLeast"),
      },
    ],
  },
]

const { tableId: activeTableId } = useSelection()
const { table: targetTable, pending: tablePending } = useTable(targetTableId)
const { fieldMetaList: tableFields } = useFieldMetaList(targetTable)

watch(
  () => activeTableId.value,
  (newVal) => {
    if (targetTableId.value === "") {
      targetTableId.value = newVal ?? ""
    }
  },
)

watch(
  () => tableFields.value,
  () => {
    if (!targetTable.value) return
    fill()
  },
)

const indexFields = computed(() =>
  tableFields.value.filter((field) => indexFieldType.includes(field.type)),
)

const excelData = ref<ExcelDataInfo>()
const {
  mode,
  settingColumns,
  fill,
  excelFields,
  sheetIndex,
  Index,
  reset,
  pending: mapPending,
} = useSetting(tableFields, excelData, activeTableId)
const importLoading = ref(false)
const currentSetting = ref<fieldMap>()

watch(
  () => props.excelData,
  (newVal) => {
    excelData.value = newVal
  },
  { deep: true },
)

watch(
  () => modeSelect.value,
  (newVal) => {
    mode.value = newVal[newVal.length - 1] as importModes
  },
)

const filters = computed(() => {
  return settingColumns.value.map((item) => {
    return {
      text: item.field.name,
      value: item.field.name,
    }
  })
})

function filterHandler(
  value: string,
  row: fieldMap,
  column: TableColumnCtx<fieldMap>,
) {
  console.log(value, row, column)
  return row.field.name === value
}

const validate = () => {
  if (!Index.value) {
    Warn({
      title: "noIndex",
      message: "noIndex",
      notice: true,
      noticeParams: {
        text: "message.noIndex",
      },
    })
    return false
  }
  const indexFieldMap = settingColumns.value.find((j) => j.field.id === Index.value) as fieldMap
  const indexes = indexFieldMap ? [indexFieldMap] : []
  const hasAuto = validateIndexAuto(indexes)
  const noEmpty = validateIndex(indexes, indexFieldConfigs.value)
  if (hasAuto) {
    changeAllowAction(AllowAction.onlyUpdate)
    allowAction.value = AllowAction.onlyUpdate
    allowAdd.value = false
  } else {
    allowAdd.value = true
  }
  return noEmpty
}

async function importAction() {
  if (!targetTableId.value) {
    Warn({
      title: "chooseTableFirst",
      message: t("message.chooseTableFirst"),
      notice: true,
      noticeParams: {
        text: "message.chooseTableFirst",
      },
    })
    return
  }
  if (!props.excelData) {
    Warn({
      title: "NoExcelFile",
      message: t("message.uploadExcelFirst"),
      notice: true,
      noticeParams: {
        text: "message.uploadExcelFirst",
      },
    })
    return
  }
  if (mode.value !== importModes.append && !validate()) return
  const sheet_index = sheetIndex.value
  const index = Index.value ? [Index.value] : null
  importLoading.value = true
  importInfoRef.value.toggleVisible()
  const { importExcel } = await import("@/utils/import/import.ts")
  
  // 将 Map 转换为普通对象以便传递
  const indexConfigsObj: Record<string, any> = {}
  indexFieldConfigs.value.forEach((value, key) => {
    indexConfigsObj[key] = value
  })
  
  await importExcel(
    toRaw(settingColumns.value),
    toRaw(props.excelData),
    sheet_index,
    index,
    mode.value,
    userOptions.value,
    toRaw(virtualIndexFields.value),
    indexConfigsObj,
  )
  importLoading.value = false
  props.onImported?.()
}

function autoFill() {
  if (!props.excelData) {
    Warn({
      title: "NoExcelFile",
      message: t("message.uploadExcelFirst"),
      notice: true,
      noticeParams: {
        text: "message.uploadExcelFirst",
      },
    })
    return
  }

  if (excelFields.value.length === 0) {
    return
  }
  fill()
}

function settingField(row: fieldMap) {
  currentSetting.value = row
  settingRef.value.toggleVisible()
}

function settingLink(row: fieldMap) {
  currentSetting.value = row
  linkRef.value.toggleVisible()
}

function getFormat(value: fieldMap["config"]) {
  if (currentSetting.value) {
    currentSetting.value.config = value
  }
}

function settingConcat(row: fieldMap) {
  currentConcatField.value = row
  concatRef.value.toggleVisible()
}

function setConcatConfig(config: ConcatConfig) {
  if (currentConcatField.value) {
    currentConcatField.value.config.concatConfig = config
    // 如果启用了拼接，清空单个字段映射，避免冲突
    if (config.enabled && config.fields.length > 0) {
      currentConcatField.value.excel_field = undefined
    }
  }
}

function setLinkField(
  linkConfig: fieldMap["linkConfig"],
  config: fieldMap["config"],
) {
  if (currentSetting.value) {
    currentSetting.value.linkConfig = linkConfig
    currentSetting.value.children?.forEach((field) => {
      if (linkConfig && field.field.id === linkConfig.primaryKey) {
        field.config = config
      }
    })
  }
}

function getModeList(): any[] {
  return [
    {
      value: "append",
      label: t("mode.append"),
    },
    {
      value: "merge",
      label: t("mode.merge"),
      children: [
        {
          value: "merge_direct",
          label: t("mode.mergeDirect"),
        },
        {
          value: "compare_merge",
          label: t("mode.compareMerge"),
        },
      ],
    },
  ]
}

onMounted(() => {
  Log({
    title: "userOptions",
    message: JSON.stringify(userOptions.value),
  })
  bitable.base
    .getTableMetaList()
    .then((res) => {
      tableList.value = res
    })
    .catch((err) => {
      Error({
        title: "getTableListError",
        message: JSON.stringify(err),
        error: err,
        notice: true,
        noticeParams: {
          text: "message.getTableListError",
        },
      })
    })
})

// 索引字段变化时初始化配置
function onIndexChange(selectedId: string) {
  validate()
  // 清理旧的配置
  indexFieldConfigs.value.clear()
  
  // 为选中的索引字段初始化配置
  if (selectedId) {
    const field = indexFields.value.find((f) => f.id === selectedId)
    if (field) {
      indexFieldConfigs.value.set(selectedId, {
        fieldId: selectedId,
        fieldName: field.name,
        useConcat: false,
        concatConfig: {
          sourceFields: [],
          separator: "",
          order: [],
        },
      })
      // 自动打开配置对话框
      openIndexConfig(selectedId)
    }
  }
}

// 获取字段类型
function getFieldType(fieldId: string) {
  return indexFields.value.find((f) => f.id === fieldId)?.type
}

// 获取字段名称
function getFieldName(fieldId: string) {
  return indexFields.value.find((f) => f.id === fieldId)?.name || fieldId
}

// 获取索引配置按钮文本
function getIndexConfigButtonText(fieldId: string) {
  const config = indexFieldConfigs.value.get(fieldId)
  return config?.useConcat ? t('button.configured') : t('button.configure')
}

// 获取拼接源字段
function getConcatSourceFields(fieldId: string) {
  const config = indexFieldConfigs.value.get(fieldId)
  if (!config?.useConcat) return []
  
  return config.concatConfig.sourceFields
    .map((name, index) => ({ name, order: config.concatConfig.order[index] ?? index }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.name)
}

// 打开索引配置对话框
function openIndexConfig(fieldId: string) {
  const field = indexFields.value.find((f) => f.id === fieldId)
  if (!field) return
  
  currentEditingFieldId.value = fieldId
  
  // 获取或初始化配置
  let config = indexFieldConfigs.value.get(fieldId)
  if (!config) {
    config = {
      fieldId,
      fieldName: field.name,
      useConcat: false,
      concatConfig: {
        sourceFields: [],
        separator: "",
        order: [],
      },
    }
    indexFieldConfigs.value.set(fieldId, config)
  }
  
  currentIndexConfig.value = JSON.parse(JSON.stringify(config))
  showIndexConfigDialog.value = true
}

// 获取源字段顺序
function getSourceFieldOrder(index: number) {
  if (!currentIndexConfig.value) return 0
  return currentIndexConfig.value.concatConfig.order[index] ?? index
}

// 获取排序后的源字段
function getOrderedSourceFields() {
  if (!currentIndexConfig.value) return []
  
  return currentIndexConfig.value.concatConfig.sourceFields
    .map((name, index) => ({ 
      name, 
      order: currentIndexConfig.value!.concatConfig.order[index] ?? index 
    }))
    .sort((a, b) => a.order - b.order)
    .map((item) => item.name)
}

// 添加源字段到索引
function addSourceFieldToIndex(fieldName: string) {
  if (!currentIndexConfig.value) return
  
  if (!currentIndexConfig.value.concatConfig.sourceFields.includes(fieldName)) {
    currentIndexConfig.value.concatConfig.sourceFields.push(fieldName)
    currentIndexConfig.value.concatConfig.order.push(
      currentIndexConfig.value.concatConfig.order.length
    )
  }
}

// 移除源字段
function removeSourceField(index: number) {
  if (!currentIndexConfig.value) return
  
  const removedOrder = currentIndexConfig.value.concatConfig.order[index]
  currentIndexConfig.value.concatConfig.sourceFields.splice(index, 1)
  currentIndexConfig.value.concatConfig.order.splice(index, 1)
  
  // 重新调整顺序
  currentIndexConfig.value.concatConfig.order = 
    currentIndexConfig.value.concatConfig.order.map((o) => 
      o > removedOrder ? o - 1 : o
    )
}

// 移动源字段顺序
function moveSourceField(index: number, direction: "up" | "down") {
  if (!currentIndexConfig.value) return
  
  const currentOrder = currentIndexConfig.value.concatConfig.order[index]
  if (direction === "up" && currentOrder > 0) {
    const prevIndex = currentIndexConfig.value.concatConfig.order.findIndex(
      (o) => o === currentOrder - 1
    )
    if (prevIndex !== -1) {
      currentIndexConfig.value.concatConfig.order[index]--
      currentIndexConfig.value.concatConfig.order[prevIndex]++
    }
  } else if (
    direction === "down" && 
    currentOrder < currentIndexConfig.value.concatConfig.sourceFields.length - 1
  ) {
    const nextIndex = currentIndexConfig.value.concatConfig.order.findIndex(
      (o) => o === currentOrder + 1
    )
    if (nextIndex !== -1) {
      currentIndexConfig.value.concatConfig.order[index]++
      currentIndexConfig.value.concatConfig.order[nextIndex]--
    }
  }
}

// 保存索引配置
function saveIndexConfig() {
  if (!currentIndexConfig.value || !currentEditingFieldId.value) return
  
  // 验证
  if (currentIndexConfig.value.useConcat && 
      currentIndexConfig.value.concatConfig.sourceFields.length === 0) {
    ElMessage.warning(t('message.virtualFieldSourceRequired'))
    return
  }
  
  indexFieldConfigs.value.set(
    currentEditingFieldId.value, 
    JSON.parse(JSON.stringify(currentIndexConfig.value))
  )
  
  showIndexConfigDialog.value = false
  ElMessage.success(t('message.configSaved'))
}

const exporting = ref(false)
const exportConfig = () => {
  exporting.value = true
  const config = {
    fieldMaps: toRaw(settingColumns.value).reduce(
      (acc, cur) => {
        acc[cur.field.id] = {
          excel_field: cur.excel_field,
          config: cur.config,
          // 包含拼接配置
          concatConfig: cur.config?.concatConfig,
        }
        return acc
      },
      {} as Record<string, any>,
    ),
    index: toRaw(Index.value),
    table: targetTableId.value,
    mode: mode.value,
  }
  const data = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(config),
  )}`
  targetTable.value?.getName().then((name) => {
    downLoadFileFromA(data, `${name}_${Date.now()}.json`)
    exporting.value = false
    ElMessage.success(t("message.exportSuccess"))
  })
}
const configImporting = ref(false)
const readConfig = async (file: UploadFile) => {
  configImporting.value = true
  if (!/\.json?$/.test(file.name)) {
    Error({
      title: "configFileTypeError",
      message: t("message.fileType"),
      notice: true,
      noticeParams: {
        text: "message.fileType",
      },
    })
    return
  }
  const config = JSON.parse((await file.raw?.text()) ?? "")
  if (!config) return
  const { fieldMaps, index, table } = config
  if (table && table !== targetTableId.value) {
    Warn({
      title: "configTableError",
      message: t("message.configTableError"),
      notice: true,
      noticeParams: {
        text: "message.configTableError",
      },
    })
    return
  }
  if (fieldMaps) {
    const excelFields = excelData.value?.sheets[
      sheetIndex.value
    ].tableData.fields.map((i) => i.name)
    settingColumns.value.forEach((item) => {
      if (fieldMaps[item.field.id]) {
        if (
          !item.excel_field &&
          excelFields?.includes(fieldMaps[item.field.id].excel_field)
        )
          item.excel_field = fieldMaps[item.field.id].excel_field
        Object.keys(item.config).forEach((key) => {
          if (fieldMaps[item.field.id].config[key]) {
            // @ts-ignore
            item.config[key] = fieldMaps[item.field.id].config[key]
          }
        })
      }
    })
  }
  if (index && index.length > 0) {
    const tableFields = settingColumns.value.map((i) => i.field.id)
    const validIndex = index.find((i: string) => tableFields.includes(i))
    if (validIndex) {
      Index.value = validIndex
      // 恢复索引配置
      onIndexChange(validIndex)
    }
  }
  ElMessage.success(t("message.importSuccess"))
  configImporting.value = false
}

defineExpose({
  index: Index,
  tableId: activeTableId,
  autoFill,
})
</script>

<template>
  <h3>
    <el-icon>
      <Setting />
    </el-icon>
    {{ t("h.settings") }}
  </h3>
  <el-form
    ref="form"
    label-position="top"
  >
    <el-form-item
      :label="t('form.label.sheet')"
      required
    >
      <el-select
        v-model="sheetIndex"
        :disabled="!excelData"
        :placeholder="t('input.placeholder.chooseSheet')"
      >
        <el-option
          v-for="(sheet, index) in excelData?.sheets"
          :key="index"
          :value="index"
          :label="sheet.name"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      :label="t('form.label.table')"
      required
    >
      <el-select
        v-model="targetTableId"
        :placeholder="t('input.placeholder.chooseTable')"
      >
        <el-option
          v-for="(table, index) in tableList"
          :key="index"
          :value="table.id"
          :label="table.name"
        />
      </el-select>
    </el-form-item>
    <el-form-item
      :label="t('form.label.fieldsMap')"
      label-width="auto"
      required
    >
      <template #label="{ label }">
        <label>{{ label }}</label>
        <div
          style="display: inline-flex; margin-left: 20px"
          class="el-form-item__content"
        >
          <el-tooltip>
            <template #content>
              {{ t("button.autoFill") }}
            </template>
            <el-button
              type="primary"
              size="default"
              @click="autoFill"
            >
              <el-icon>
                <EditPen />
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip>
            <template #content>
              {{ t("button.clear") }}
            </template>
            <el-button
              type="danger"
              size="default"
              @click="reset"
            >
              <el-icon>
                <DeleteFilled />
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip>
            <template #content>
              {{ t("button.exportConfig") }}
            </template>
            <el-button
              v-loading="exporting"
              type="primary"
              size="default"
              @click="exportConfig"
            >
              <el-icon>
                <ExportIcon />
              </el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip>
            <template #content>
              {{ t("button.importConfig") }}
            </template>
            <el-upload
              style="display: inline-flex; margin-left: 12px"
              :limit="1"
              :auto-upload="false"
              :on-change="readConfig"
              accept=".json"
              :show-file-list="false"
            >
              <template #trigger>
                <el-button type="primary">
                  <el-icon>
                    <ImportIcon />
                  </el-icon>
                </el-button>
              </template>
            </el-upload>
          </el-tooltip>
        </div>
      </template>
      <el-table
        v-loading="tablePending || mapPending"
        ref="chooseRef"
        stripe
        max-height="250"
        :data="
          settingColumns.filter(
            (i) =>
              cellTranslator.supportTypes.includes(i.field.type) ||
              indexFieldType.includes(i.field.type),
          )
        "
        row-key="key"
      >
        <el-table-column
          :label="t('table.baseField')"
          :filters="filters"
          :filter-method="filterHandler"
          prop="field.name"
          filter-placement="bottom-end"
        >
          <template #default="{ row }">
            <field-icon :type="row.field.type" />

            {{ row.field.name }}
            <el-tooltip
              v-if="row.linkConfig"
              :content="t('toolTip.setInputFormat')"
            >
              <el-button
                :icon="Key"
                @click="settingLink(row)"
              ></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column :label="t('table.excelField')">
          <template #default="{ row }">
            <el-select-v2
              v-if="row.root"
              v-model="row.excel_field"
              :disabled="!(excelFields.length > 0)"
              :options="
                excelFields.map((i) => ({ label: i.name, value: i.name }))
              "
              :placeholder="t('input.placeholder.chooseField')"
              @change="console.log(excelFields, settingColumns)"
              filterable
              clearable
            />
            <el-tooltip
              v-if="
                Object.keys(row.config).some((i) =>
                  settingRef.allowConfig.includes(i),
                )
              "
              :content="t('toolTip.setInputFormat')"
            >
              <el-button
                :disabled="!(excelFields.length > 0)"
                :icon="Setting"
                @click="settingField(row)"
              ></el-button>
            </el-tooltip>
            <!-- 字段拼接按钮 -->
            <el-tooltip :content="t('toolTip.concatFields')">
              <el-button
                :disabled="!(excelFields.length > 0)"
                :icon="Tools"
                :type="row.config?.concatConfig?.enabled ? 'success' : 'default'"
                @click="settingConcat(row)"
              ></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-form-item>
    <el-form-item
      :label="t('form.label.mode')"
      required
    >
      <el-cascader
        v-model="modeSelect"
        :options="getModeList()"
      />
    </el-form-item>
    <!-- 索引字段选择（合并模式） -->
    <el-form-item
      v-if="modeSelect[0] !== 'append'"
      :label="t('form.label.index')"
      required
    >
      <template #label="{ label }">
        {{ label }}
        <el-tooltip effect="dark">
          <template #content>
            {{ t("toolTip.indexInfo") }}
          </template>
          <el-icon>
            <Lock />
          </el-icon>
        </el-tooltip>
      </template>
      
      <!-- 索引字段选择 - 下拉框式展示 -->
      <div class="index-field-selector">
        <el-select-v2
          v-model="Index"
          :options="indexFields.map(item => ({ 
            label: item.name, 
            value: item.id,
            type: item.type,
            isPrimary: item.isPrimary
          }))"
          :placeholder="t('input.placeholder.chooseIndexField')"
          @change="onIndexChange"
          filterable
          clearable
          style="width: 300px"
        >
          <template #default="{ item }">
            <div style="display: flex; align-items: center; gap: 8px">
              <field-icon :type="item.type" />
              <span>{{ item.label }}</span>
              <el-tag v-if="item.isPrimary" size="small" type="success">
                {{ t('label.primary') }}
              </el-tag>
            </div>
          </template>
        </el-select-v2>
        
        <!-- 配置按钮（仅在选中时显示） -->
        <el-tooltip v-if="Index" :content="t('toolTip.indexFieldConfig')">
          <el-button
            type="primary"
            :icon="Setting"
            @click="openIndexConfig(Index)"
            style="margin-left: 8px"
          >
            {{ getIndexConfigButtonText(Index) }}
          </el-button>
        </el-tooltip>
        
        <!-- 配置预览 -->
        <div v-if="Index && indexFieldConfigs.get(Index)?.useConcat" class="config-preview" style="margin-top: 8px">
          <el-text type="info" size="small">
            <el-icon><Link /></el-icon>
            {{ getConcatSourceFields(Index).join(indexFieldConfigs.get(Index)?.concatConfig?.separator || '') }}
          </el-text>
        </div>
        
        <el-text v-if="!Index" type="warning" size="small" style="display: block; margin-top: 8px">
          {{ t('message.pleaseSelectIndex') }}
        </el-text>
      </div>
    </el-form-item>

    <!-- 索引字段配置对话框 -->
    <el-dialog
      v-model="showIndexConfigDialog"
      :title="t('h.indexFieldConfig')"
      width="600px"
    >
      <el-form label-position="top" v-if="currentIndexConfig">
        <el-form-item :label="t('form.label.indexField')">
          <el-input :model-value="currentIndexConfig.fieldName" disabled />
        </el-form-item>
        
        <el-form-item :label="t('form.label.useConcatForIndex')">
          <el-switch v-model="currentIndexConfig.useConcat" />
        </el-form-item>
        
        <template v-if="currentIndexConfig.useConcat">
          <el-form-item :label="t('form.label.concatSeparator')">
            <el-input
              v-model="currentIndexConfig.concatConfig.separator"
              :placeholder="t('input.placeholder.concatSeparator')"
              clearable
            />
          </el-form-item>
          
          <el-form-item :label="t('form.label.selectSourceFields')" required>
            <el-select-v2
              :options="excelFields.map((f) => ({ label: f.name, value: f.name }))"
              :placeholder="t('input.placeholder.selectSourceFields')"
              filterable
              clearable
              @change="(val) => val && addSourceFieldToIndex(val as string)"
              style="width: 100%; margin-bottom: 10px"
            />
          </el-form-item>
          
          <el-form-item
            v-if="currentIndexConfig.concatConfig.sourceFields.length > 0"
            :label="t('form.label.selectedSourceFields')"
          >
            <el-table :data="currentIndexConfig.concatConfig.sourceFields" size="small">
              <el-table-column :label="t('table.fieldName')">
                <template #default="{ row, $index }">
                  <div style="display: flex; align-items: center; gap: 8px">
                    <el-tag type="primary" size="small">
                      {{ getSourceFieldOrder($index) + 1 }}
                    </el-tag>
                    <span>{{ row }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column :label="t('table.operation')" width="150" align="right">
                <template #default="{ $index }">
                  <el-button
                    :disabled="currentIndexConfig.concatConfig.order[$index] === 0"
                    link
                    type="primary"
                    @click="moveSourceField($index, 'up')"
                  >
                    <el-icon><ArrowUp /></el-icon>
                  </el-button>
                  <el-button
                    :disabled="currentIndexConfig.concatConfig.order[$index] === currentIndexConfig.concatConfig.sourceFields.length - 1"
                    link
                    type="primary"
                    @click="moveSourceField($index, 'down')"
                  >
                    <el-icon><ArrowDown /></el-icon>
                  </el-button>
                  <el-button link type="danger" @click="removeSourceField($index)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-form-item>
          
          <el-form-item :label="t('form.label.concatPreview')">
            <el-card shadow="never">
              <div style="font-family: monospace">
                <el-tag
                  v-for="field in getOrderedSourceFields()"
                  :key="field"
                  size="small"
                  style="margin: 2px"
                >
                  {{ field }}
                </el-tag>
                <div v-if="currentIndexConfig.concatConfig.separator" style="margin-top: 8px; color: #909399">
                  {{ t('form.label.separator') }}: "{{ currentIndexConfig.concatConfig.separator }}"
                </div>
              </div>
            </el-card>
          </el-form-item>
        </template>
      </el-form>
      
      <template #footer>
        <el-button @click="showIndexConfigDialog = false">{{ t('button.cancel') }}</el-button>
        <el-button type="primary" @click="saveIndexConfig">{{ t('button.confirm') }}</el-button>
      </template>
    </el-dialog>
    <el-form-item
      :label="t('form.label.allowAction')"
      v-if="modeSelect[0] !== 'append'"
      required
    >
      <el-radio-group
        v-model="allowAction"
        style="display: flex; flex-direction: column; align-items: flex-start"
        @change="changeAllowAction"
      >
        <el-radio
          :label="AllowAction.updateAndAdd"
          :disabled="!allowAdd"
          >{{ t("allowAction.updateAndAdd") }}</el-radio
        >
        <el-radio
          :label="AllowAction.onlyAdd"
          :disabled="!allowAdd"
          >{{ t("allowAction.onlyAdd") }}</el-radio
        >
        <el-radio :label="AllowAction.onlyUpdate">{{
          t("allowAction.onlyUpdate")
        }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item
      :label="t('form.label.whenTwoSame')"
      v-if="modeSelect[0] !== 'append' && userOptions.allowAction?.update"
      required
    >
      <el-cascader
        :placeholder="t('form.label.saveFirst')"
        :options="updateOptionSelector()"
        v-model="userOptions.updateOption!.mode"
        separator=">"
      ></el-cascader>
    </el-form-item>
  </el-form>
  <el-space>
    <el-button
      type="primary"
      :loading="importLoading"
      @click="importAction"
      >{{ t("button.import") }}</el-button
    >
    <el-tooltip
      v-if="importLoading"
      effect="dark"
    >
      <template #content>
        {{ t("toolTip.importInfo") }}
      </template>
      <el-icon
        size="20"
        @click="importInfoRef.toggleVisible"
        style="cursor: pointer"
        class="is-loading"
      >
        <Refresh />
      </el-icon>
    </el-tooltip>
  </el-space>

  <fieldSetting
    ref="settingRef"
    @confirmFormat="getFormat"
    :field="currentSetting"
  ></fieldSetting>
  <linkSetting
    ref="linkRef"
    @confirmSetting="setLinkField"
    :field="currentSetting"
  />
  <concatSetting
    ref="concatRef"
    @confirmConcat="setConcatConfig"
    :field="currentConcatField"
    :excelFields="excelFields"
  />
  <importInfo ref="importInfoRef" />
</template>

<style scoped>
.index-fields-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 10px;
  background-color: #f5f7fa;
}

/* 卡片式字段选择 */
.index-field-cards {
  margin-bottom: 10px;
}

.field-cards-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.index-field-card {
  cursor: pointer;
  transition: all 0.3s;
}

.index-field-card:hover {
  border-color: #409eff;
}

.index-field-card.selected {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-icon-wrapper {
  margin-right: 8px;
}

.field-name {
  font-weight: 500;
}

.primary-tag {
  margin-left: auto;
}

.card-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.config-preview {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #dcdfe6;
}

.index-config-list {
  margin-top: 10px;
}

.index-config-item {
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 8px;
}

.index-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}
</style>
