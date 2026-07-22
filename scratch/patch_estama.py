import re

with open('lib/sync/estama.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove `triggerChange` from page.evaluate
code = code.replace("""        const triggerChange = (el: HTMLSelectElement) => {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };""", "")
code = code.replace("triggerChange(sel);", "")
code = code.replace("triggerChange(select);", "")

# 1.5 Fix rowMins logic
# Replace:
#              let rowMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
#              
#              // 深夜帯の処理 (0:00 ~ 11:00 は 24 ~ 35 として扱う)
#              if (rowMins < 12 * 60) {
#                rowMins += 24 * 60;
#              }
rowMins_old = """              let rowMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
              
              // 深夜帯の処理 (0:00 ~ 11:00 は 24 ~ 35 として扱う)
              if (rowMins < 12 * 60) {
                rowMins += 24 * 60;
              }"""
rowMins_new = """              let rowMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
              // Note: Estama naturally uses 25:00 format, no need to add 24 hours."""
code = code.replace(rowMins_old, rowMins_new)
# In case it's formatted differently, let's just use regex for rowMins < 12 * 60
code = re.sub(r'if \s*\(\s*rowMins\s*<\s*12\s*\*\s*60\s*\)\s*\{\s*rowMins\s*\+=\s*24\s*\*\s*60;\s*\}', '', code)

# 2. Modify loop to use Promise.all chunks
old_loop = """    for (const estamaId of targetTherapists) {
      console.log(`[EstamaSync] Processing therapist ${estamaId}`);
      
      const therapistShifts = shifts.filter(s => s.therapists?.estama_therapist_id === estamaId);
      // セラピストの内部IDを取得して予約を絞り込む
      const internalTherapistId = therapistShifts[0]?.therapists?.id;
      const therapistReservations = reservations ? reservations.filter(r => r.therapist_id === internalTherapistId) : [];

      // スケジュール設定ページヘの遷移
      const scheduleUrl = `https://estama.jp/admin/schedule/${estamaId}/`;
      await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});"""

new_loop = """    const chunkArray = (arr: any[], size: number) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const chunks = chunkArray(targetTherapists, 3);

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (estamaId) => {
        const tPage = await context.newPage();
        try {
          await tPage.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
              return route.abort();
            }
            return route.continue();
          });

          console.log(`[EstamaSync] Processing therapist ${estamaId}`);
          
          const therapistShifts = shifts.filter(s => s.therapists?.estama_therapist_id === estamaId);
          const internalTherapistId = therapistShifts[0]?.therapists?.id || activeTherapists?.find(t => t.estama_therapist_id === estamaId)?.id;
          const therapistReservations = reservations ? reservations.filter(r => r.therapist_id === internalTherapistId) : [];

          const scheduleUrl = `https://estama.jp/admin/schedule/${estamaId}/`;
          await tPage.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});"""

code = code.replace(old_loop, new_loop)

# 3. Replace `page.evaluate` and `page.xxx` with `tPage.xxx` inside the loop ONLY
loop_body_start = code.find("      // startDate と endDate から同期対象の全ての日付の mmdd を生成する")
loop_body_end = code.find("    return { success: true, message: 'エステ魂への出勤情報・予約状況の同期が完了しました。' };")
loop_body = code[loop_body_start:loop_body_end]

new_loop_body = loop_body.replace("page.evaluate", "tPage.evaluate")
new_loop_body = new_loop_body.replace("page.$", "tPage.$")
new_loop_body = new_loop_body.replace("page.waitForNavigation", "tPage.waitForNavigation")
new_loop_body = new_loop_body.replace("page.waitForTimeout", "tPage.waitForTimeout")

new_loop_body = new_loop_body.replace("""      } else {
        console.warn(`[EstamaSync] 保存ボタンが見つかりませんでした (therapist: ${estamaId})`);
      }
    }""", """      } else {
        console.warn(`[EstamaSync] 保存ボタンが見つかりませんでした (therapist: ${estamaId})`);
      }
        } catch (e: any) {
          console.error(`[EstamaSync] Error on therapist ${estamaId}:`, e);
        } finally {
          await tPage.close();
        }
      }));
    }""")

code = code[:loop_body_start] + new_loop_body + code[loop_body_end:]

with open('lib/sync/estama.ts', 'w', encoding='utf-8') as f:
    f.write(code)
