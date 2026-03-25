<script lang="ts" setup>
import { ref, watch, computed } from "vue"
import { useI18n } from "vue-i18n"
import type { fieldMap, ConcatConfig } from "@/types/types"
import { Tools } from "@element-plus/icons-vue"

const { t } = useI18n()

const props = defineProps({
  field: {
    type: Object as () => fieldMap,
  },
  /** Excel字段列表 */
  excelFields: {
    type: Array as () => { name: string }[],
    default: () => [],
  },
})

const isVisible = ref(false)
const concatConfig = ref<ConcatConfig>({
  enabled: false,
  fields: [],
  separator: "",
  order: [],
})

// 可选的Excel字段（排除当前已选择的字段）
const availableFields = computed(() => {
  return props.excelFields.filter(
    (f) => f.name !== props.field?.excel_field && !concatConfig.value.fields.includes(f.name)
  )
})

// 已选择的拼接字段（按顺序）
const selectedFields = computed(() => {
  return concatConfig.value.fields
    .map((name, index) => ({ name, order: concatConfig.value.order[index] ?? index }))
    .sort((a, b) => a.order - b.order)
})

watch(
  () => props.field,
  (newVal) => {
    if (newVal?.config?.concatConfig) {
      concatConfig.value = JSON.parse(JSON.stringify(newVal.config.concatConfig))
    } else {
      concatConfig.value = {
        enabled: false,
        fields: [],
        separator: "",
        order: [],
      }
    }
  },
  { deep: true, immediate: true }
)

const emits = defineEmits<{
  (e: "confirmConcat", config: ConcatConfig): void
}>()

function toggleVisible() {
  isVisible.value = !isVisible.value
}

function confirm() {
  emits("confirmConcat", JSON.parse(JSON.stringify(concatConfig.value)))
  toggleVisible()
}

// 添加字段到拼接列表
function addField(fieldName: string) {
  if (!concatConfig.value.fields.includes(fieldName)) {
    concatConfig.value.fields.push(fieldName)
    concatConfig.value.order.push(concatConfig.value.order.length)
  }
}

// 从拼接列表移除字段
function removeField(index: number) {
  const fieldName = concatConfig.value.fields[index]
  const removedOrder = concatConfig.value.order[index]
  
  concatConfig.value.fields.splice(index, 1)
  concatConfig.value.order.splice(index, 1)
  
  // 重新调整顺序
  concatConfig.value.order = concatConfig.value.order.map((o) => 
    o > removedOrder ? o - 1 : o
  )
}

// 移动字段顺序
function moveField(index: number, direction: "up" | "down") {
  const currentOrder = concatConfig.value.order[index]
  if (direction === "up" && currentOrder > 0) {
    const prevIndex = concatConfig.value.order.findIndex((o) => o === currentOrder - 1)
    if (prevIndex !== -1) {
      concatConfig.value.order[index]--
      concatConfig.value.order[prevIndex]++
    }
  } else if (direction === "down" && currentOrder < concatConfig.value.fields.length - 1) {
    const nextIndex = concatConfig.value.order.findIndex((o) => o === currentOrder + 1)
    if (nextIndex !== -1) {
      concatConfig.value.order[index]++
      concatConfig.value.order[nextIndex]--
    }
  }
}

// 清空所有拼接字段
function clearAll() {
  concatConfig.value.fields = []
  concatConfig.value.order = []
}

defineExpose({
  toggleVisible,
  isVisible,
})
</script>

<template>
  <el-dialog
    v-model="isVisible"
    lock-scroll
    fullscreen
    :title="t('h.concatSetting')"
  >
    <el-scrollbar max-height="60vh">
      <div style="padding: 10px">
        <el-form label-position="top">
          <!-- 启用拼接开关 -->
          <el-form-item :label="t('form.label.enableConcat')">
            <el-switch v-model="concatConfig.enabled" />
          </el-form-item>

          <template v-if="concatConfig.enabled">
            <!-- 分隔符设置 -->
            <el-form-item :label="t('form.label.concatSeparator')">
              <el-input
                v-model="concatConfig.separator"
                :placeholder="t('input.placeholder.concatSeparator')"
                clearable
              />
              <el-text type="info" size="small">
                {{ t("toolTip.concatSeparatorTip") }}
              </el-text>
            </el-form-item>

            <!-- 选择要拼接的字段 -->
            <el-form-item :label="t('form.label.selectConcatFields')" required>
              <el-select-v2
                :options="availableFields.map((f) => ({ label: f.name, value: f.name }))"
                :placeholder="t('input.placeholder.selectFieldsToConcat')"
                filterable
                clearable
                @change="(val) => val && addField(val as string)"
                style="width: 100%; margin-bottom: 10px"
              />
            </el-form-item>

            <!-- 已选择的字段列表 -->
            <el-form-item :label="t('form.label.selectedFields')" v-if="concatConfig.fields.length > 0">
              <el-table :data="concatConfig.fields" style="width: 100%">
                <el-table-column :label="t('table.fieldName')" prop="name">
                  <template #default="{ row, $index }">
                    <div style="display: flex; align-items: center; gap: 8px">
                      <el-tag type="primary" size="small">
                        {{ selectedFields.find((f) => f.name === row)?.order + 1 }}
                      </el-tag>
                      <span>{{ row }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column :label="t('table.operation')" width="150" align="right">
                  <template #default="{ $index }">
                    <el-button
                      :disabled="concatConfig.order[$index] === 0"
                      link
                      type="primary"
                      @click="moveField($index, 'up')"
                    >
                      <el-icon><Arrow-Up /></el-icon>
                    </el-button>
                    <el-button
                      :disabled="concatConfig.order[$index] === concatConfig.fields.length - 1"
                      link
                      type="primary"
                      @click="moveField($index, 'down')"
                    >
                      <el-icon><Arrow-Down /></el-icon>
                    </el-button>
                    <el-button link type="danger" @click="removeField($index)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-form-item>

            <!-- 预览 -->
            <el-form-item :label="t('form.label.concatPreview')" v-if="concatConfig.fields.length > 0">
              <el-card shadow="never">
                <template #header>
                  <span>{{ t("form.label.concatFormula") }}</span>
                </template>
                <div style="font-family: monospace; word-break: break-all">
                  <el-tag
                    v-for="(field, index) in selectedFields"
                    :key="field.name"
                    size="small"
                    style="margin: 2px"
                  >
                    {{ field.name }}
                  </el-tag>
                  <div v-if="concatConfig.separator" style="margin-top: 8px; color: #909399">
                    {{ t("form.label.separator") }}: "{{ concatConfig.separator }}"
                  </div>
                </div>
              </el-card>
            </el-form-item>

            <!-- 快速清空 -->
            <el-form-item v-if="concatConfig.fields.length > 0">
              <el-button type="danger" plain size="small" @click="clearAll">
                <el-icon><Delete /></el-icon>
                {{ t("button.clearAll") }}
              </el-button>
            </el-form-item>
          </template>
        </el-form>
      </div>
    </el-scrollbar>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="isVisible = false">{{ t("button.cancel") }}</el-button>
        <el-button type="primary" @click="confirm()">{{ t("button.confirm") }}</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
