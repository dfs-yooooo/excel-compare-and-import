<script lang="ts" setup>
import { ref, computed } from "vue"
import { useI18n } from "vue-i18n"
import type { VirtualIndexField } from "@/types/types"
import { Plus, Delete, ArrowUp, ArrowDown, Edit } from "@element-plus/icons-vue"
import { ElMessage } from "element-plus"

const { t } = useI18n()

const props = defineProps({
  /** Excel字段列表 */
  excelFields: {
    type: Array as () => { name: string }[],
    default: () => [],
  },
  /** 已配置的虚拟字段列表 */
  modelValue: {
    type: Array as () => VirtualIndexField[],
    default: () => [],
  },
})

const emits = defineEmits<{
  (e: "update:modelValue", value: VirtualIndexField[]): void
}>()

const isVisible = ref(false)
const isEdit = ref(false)
const editIndex = ref(-1)

// 当前编辑的虚拟字段
const currentField = ref<VirtualIndexField>({
  id: "",
  name: "",
  sourceFields: [],
  separator: "",
  order: [],
})

// 可选的Excel字段（排除已选择的）
const availableFields = computed(() => {
  return props.excelFields.filter(
    (f) => !currentField.value.sourceFields.includes(f.name)
  )
})

// 已选择的字段（按顺序）
const selectedFields = computed(() => {
  return currentField.value.sourceFields
    .map((name, index) => ({ 
      name, 
      order: currentField.value.order[index] ?? index 
    }))
    .sort((a, b) => a.order - b.order)
})

// 生成唯一ID
function generateId(): string {
  return `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 打开添加对话框
function openAdd() {
  isEdit.value = false
  editIndex.value = -1
  currentField.value = {
    id: generateId(),
    name: "",
    sourceFields: [],
    separator: "",
    order: [],
  }
  isVisible.value = true
}

// 打开编辑对话框
function openEdit(index: number) {
  isEdit.value = true
  editIndex.value = index
  currentField.value = JSON.parse(JSON.stringify(props.modelValue[index]))
  isVisible.value = true
}

// 删除虚拟字段
function removeField(index: number) {
  const newList = [...props.modelValue]
  newList.splice(index, 1)
  emits("update:modelValue", newList)
}

// 确认保存
function confirm() {
  if (!currentField.value.name.trim()) {
    ElMessage.warning(t("message.virtualFieldNameRequired"))
    return
  }
  if (currentField.value.sourceFields.length === 0) {
    ElMessage.warning(t("message.virtualFieldSourceRequired"))
    return
  }

  const newList = [...props.modelValue]
  if (isEdit.value && editIndex.value >= 0) {
    newList[editIndex.value] = { ...currentField.value }
  } else {
    newList.push({ ...currentField.value })
  }
  emits("update:modelValue", newList)
  isVisible.value = false
}

// 添加字段到列表
function addField(fieldName: string) {
  if (!currentField.value.sourceFields.includes(fieldName)) {
    currentField.value.sourceFields.push(fieldName)
    currentField.value.order.push(currentField.value.order.length)
  }
}

// 从列表移除字段
function removeSourceField(index: number) {
  const removedOrder = currentField.value.order[index]
  
  currentField.value.sourceFields.splice(index, 1)
  currentField.value.order.splice(index, 1)
  
  // 重新调整顺序
  currentField.value.order = currentField.value.order.map((o) => 
    o > removedOrder ? o - 1 : o
  )
}

// 移动字段顺序
function moveField(index: number, direction: "up" | "down") {
  const currentOrder = currentField.value.order[index]
  if (direction === "up" && currentOrder > 0) {
    const prevIndex = currentField.value.order.findIndex((o) => o === currentOrder - 1)
    if (prevIndex !== -1) {
      currentField.value.order[index]--
      currentField.value.order[prevIndex]++
    }
  } else if (direction === "down" && currentOrder < currentField.value.sourceFields.length - 1) {
    const nextIndex = currentField.value.order.findIndex((o) => o === currentOrder + 1)
    if (nextIndex !== -1) {
      currentField.value.order[index]++
      currentField.value.order[nextIndex]--
    }
  }
}

defineExpose({
  openAdd,
})
</script>

<template>
  <div class="virtual-index-setting">
    <!-- 已配置的虚拟字段列表 -->
    <div v-if="modelValue.length > 0" class="virtual-fields-list">
      <el-table :data="modelValue" style="width: 100%; margin-bottom: 10px" size="small">
        <el-table-column :label="t('table.virtualFieldName')" prop="name" min-width="120" />
        <el-table-column :label="t('table.sourceFields')" min-width="200">
          <template #default="{ row }">
            <el-tag 
              v-for="field in row.sourceFields" 
              :key="field"
              size="small"
              style="margin: 2px"
            >
              {{ field }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('table.concatPreview')" min-width="150">
          <template #default="{ row }">
            <el-text type="info" size="small" truncated>
              {{ row.sourceFields.join(row.separator || '') }}
            </el-text>
          </template>
        </el-table-column>
        <el-table-column :label="t('table.operation')" width="100" align="right">
          <template #default="{ $index }">
            <el-button link type="primary" @click="openEdit($index)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button link type="danger" @click="removeField($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 添加按钮 -->
    <el-button type="primary" plain size="small" @click="openAdd">
      <el-icon><Plus /></el-icon>
      {{ t('button.addVirtualIndexField') }}
    </el-button>

    <!-- 配置对话框 -->
    <el-dialog
      v-model="isVisible"
      :title="isEdit ? t('h.editVirtualIndexField') : t('h.addVirtualIndexField')"
      width="600px"
    >
      <el-form label-position="top">
        <!-- 字段名称 -->
        <el-form-item :label="t('form.label.virtualFieldName')" required>
          <el-input
            v-model="currentField.name"
            :placeholder="t('input.placeholder.virtualFieldName')"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <!-- 分隔符 -->
        <el-form-item :label="t('form.label.concatSeparator')">
          <el-input
            v-model="currentField.separator"
            :placeholder="t('input.placeholder.concatSeparator')"
            clearable
          />
          <el-text type="info" size="small">
            {{ t('toolTip.concatSeparatorTip') }}
          </el-text>
        </el-form-item>

        <!-- 选择源字段 -->
        <el-form-item :label="t('form.label.selectSourceFields')" required>
          <el-select-v2
            :options="availableFields.map((f) => ({ label: f.name, value: f.name }))"
            :placeholder="t('input.placeholder.selectSourceFields')"
            filterable
            clearable
            @change="(val) => val && addField(val as string)"
            style="width: 100%; margin-bottom: 10px"
          />
        </el-form-item>

        <!-- 已选择的字段 -->
        <el-form-item 
          v-if="currentField.sourceFields.length > 0" 
          :label="t('form.label.selectedSourceFields')"
        >
          <el-table :data="currentField.sourceFields" style="width: 100%" size="small">
            <el-table-column :label="t('table.fieldName')">
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
                  :disabled="currentField.order[$index] === 0"
                  link
                  type="primary"
                  @click="moveField($index, 'up')"
                >
                  <el-icon><ArrowUp /></el-icon>
                </el-button>
                <el-button
                  :disabled="currentField.order[$index] === currentField.sourceFields.length - 1"
                  link
                  type="primary"
                  @click="moveField($index, 'down')"
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

        <!-- 预览 -->
        <el-form-item 
          v-if="currentField.sourceFields.length > 0" 
          :label="t('form.label.concatPreview')"
        >
          <el-card shadow="never">
            <div style="font-family: monospace; word-break: break-all">
              <el-tag
                v-for="field in selectedFields"
                :key="field.name"
                size="small"
                style="margin: 2px"
              >
                {{ field.name }}
              </el-tag>
              <div v-if="currentField.separator" style="margin-top: 8px; color: #909399">
                {{ t('form.label.separator') }}: "{{ currentField.separator }}"
              </div>
            </div>
          </el-card>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="isVisible = false">{{ t('button.cancel') }}</el-button>
        <el-button type="primary" @click="confirm">{{ t('button.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.virtual-index-setting {
  margin: 10px 0;
}

.virtual-fields-list {
  margin-bottom: 10px;
}
</style>
