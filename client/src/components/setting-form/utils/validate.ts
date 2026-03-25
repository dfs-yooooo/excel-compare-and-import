import type { fieldMap, IndexFieldConfig } from "@/types/types"
import { Warn, autoFields } from "@/utils"

/**
 * Validate if index is empty or has no excel_field, if yes, return false, else return true
 * 
 * @param index - Index field maps
 * @param indexConfigs - Index field configurations (for concat support)
 * @returns boolean
 */
export function validateIndex(
  index: fieldMap[], 
  indexConfigs: Map<string, IndexFieldConfig> = new Map()
) {
  if (index.length === 0) {
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
  
  // Check fields that don't have excel_field and don't have concat config
  const noExcelField = index.filter((i) => {
    // If has excel_field, it's OK
    if (i.excel_field) return false
    
    // If has concat config and useConcat is true, it's OK
    const config = indexConfigs.get(i.field.id)
    if (config?.useConcat && config.concatConfig.sourceFields.length > 0) {
      return false
    }
    
    // Otherwise, it's missing mapping
    return true
  })
  
  if (noExcelField.length) {
    const names = noExcelField.map((i) => i.field.name).join(", ")
    Warn({
      title: "noExcelField",
      message: names,
      notice: true,
      noticeParams: {
        text: "message.indexNoExcelField",
        params: {
          fields: names,
        },
      },
    })
    return false
  }
  return true
}

/**
 * Validate if index contains auto field, if yes, return true, else return false
 *
 * @param index
 * @returns
 */
export function validateIndexAuto(index: fieldMap[]) {
  const auto = index.filter((i) => autoFields.includes(i.field.type))
  if (auto.length) {
    const names = auto.map((i) => i.field.name).join(", ")
    Warn({
      title: "autoFieldInIndex",
      message: "autoFieldInIndex: " + names,
      notice: true,
      noticeParams: {
        text: "message.autoFieldInIndex",
        params: {
          fields: names,
        },
      },
    })
    return true
  }
  return false
}
