import re

with open('lib/sync/estama.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Restore triggerChange definition inside evaluate
if "const triggerChange = (el" not in code:
    insert_pos = code.find("const parseJST = (dStr: any) => {")
    trigger_code = """        const triggerChange = (el: HTMLSelectElement) => {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        
        """
    code = code[:insert_pos] + trigger_code + code[insert_pos:]

# 2. Add triggerChange to dropdown processing
dropdown_logic = """[ {sel: selects[0], val: sStart}, {sel: selects[1], val: sEnd} ].forEach(({sel, val}) => {
                      for (const opt of Array.from(sel.options)) {
                        if (opt.text.includes(val) || opt.value.includes(val)) {
                          if (sel.value !== opt.value) {
                            sel.value = opt.value;
                          }
                          break;
                        }
                      }
                    });"""
dropdown_logic_new = """[ {sel: selects[0], val: sStart}, {sel: selects[1], val: sEnd} ].forEach(({sel, val}) => {
                      for (const opt of Array.from(sel.options)) {
                        if (opt.text.includes(val) || opt.value.includes(val)) {
                          if (sel.value !== opt.value) {
                            sel.value = opt.value;
                            triggerChange(sel as HTMLSelectElement);
                          }
                          break;
                        }
                      }
                    });"""
code = code.replace(dropdown_logic, dropdown_logic_new)

dropdown_empty_logic = """[ selects[0], selects[1] ].forEach(sel => {
                      for (const opt of Array.from(sel.options)) {
                        if (opt.value === '' || opt.text.includes('出勤') || opt.text.includes('退勤') || opt.text.includes('未設定')) {
                          if (sel.value !== opt.value) {
                            sel.value = opt.value;
                          }
                          break;
                        }
                      }
                    });"""
dropdown_empty_logic_new = """[ selects[0], selects[1] ].forEach(sel => {
                      for (const opt of Array.from(sel.options)) {
                        if (opt.value === '' || opt.text.includes('出勤') || opt.text.includes('退勤') || opt.text.includes('未設定')) {
                          if (sel.value !== opt.value) {
                            sel.value = opt.value;
                            triggerChange(sel as HTMLSelectElement);
                          }
                          break;
                        }
                      }
                    });"""
code = code.replace(dropdown_empty_logic, dropdown_empty_logic_new)

# 3. Completely remove the `○` and `─` setting logic for slots. Only keep `×` for reservations.
slots_logic = """                  if (colData.shift) {
                    const sStart = timeToMins(colData.shift.start_time, colData.shift.start_time);
                    const sEnd = timeToMins(colData.shift.end_time, colData.shift.start_time);
                    
                    if (rowMins >= sStart && rowMins < sEnd) {
                      // 出勤時間内：予約チェック
                      const isReserved = colData.res.some((r: any) => {
                        const rStart = timeToMins(r.start_time, colData.shift.start_time);
                        const rEnd = timeToMins(r.end_time, colData.shift.start_time);
                        // 30分枠と予約枠の重複判定
                        return rowMins < rEnd && (rowMins + 30) > rStart;
                      });
                      targetStatus = isReserved ? '×' : '○';
                    } else {
                      // 出勤時間外
                      targetStatus = '─';
                    }
                  } else {
                    // シフトがない日
                    targetStatus = '─';
                  }
                  
                  if (targetStatus === '─') {
                    for (const opt of Array.from(select.options)) {
                      if (opt.value === '0' || opt.text.includes('─') || opt.text.includes('お休み') || opt.text.includes('未設定')) {
                        if (select.value !== opt.value) {
                          select.value = opt.value;
                        }
                        break;
                      }
                    }
                  } else {
                    for (const opt of Array.from(select.options)) {
                      // 記号揺れや表記揺れを考慮。エステ魂の実際のオプション値（1: ○, 2: ×）も考慮
                      const t = opt.text;
                      const val = opt.value;
                      if (
                        t.includes(targetStatus) || 
                        (targetStatus === '×' && (val === '2' || t.includes('x') || t.includes('✕') || t.includes('空きなし'))) ||
                        (targetStatus === '○' && (val === '1' || t.includes('受付中') || t === '〇'))
                      ) {
                        if (select.value !== opt.value) {
                          select.value = opt.value;
                        }
                        break;
                      }
                    }
                  }"""

slots_logic_new = """                  if (colData.shift) {
                    const sStart = timeToMins(colData.shift.start_time, colData.shift.start_time);
                    const sEnd = timeToMins(colData.shift.end_time, colData.shift.start_time);
                    
                    if (rowMins >= sStart && rowMins < sEnd) {
                      const isReserved = colData.res.some((r: any) => {
                        const rStart = timeToMins(r.start_time, colData.shift.start_time);
                        const rEnd = timeToMins(r.end_time, colData.shift.start_time);
                        return rowMins < rEnd && (rowMins + 30) > rStart;
                      });
                      
                      if (isReserved) {
                        for (const opt of Array.from(select.options)) {
                          const t = opt.text;
                          const val = opt.value;
                          if (val === '2' || t.includes('x') || t.includes('✕') || t.includes('空きなし') || t.includes('×')) {
                            if (select.value !== opt.value) {
                              select.value = opt.value;
                              triggerChange(select as HTMLSelectElement);
                            }
                            break;
                          }
                        }
                      }
                    }
                  }"""
code = code.replace(slots_logic, slots_logic_new)

with open('lib/sync/estama.ts', 'w', encoding='utf-8') as f:
    f.write(code)
