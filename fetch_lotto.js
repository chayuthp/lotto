/**
 * สคริปต์สำหรับดึงข้อมูลหวยไทยจาก API
 * ดึงข้อมูลตั้งแต่วันที่ปัจจุบันย้อนหลังไปถึงปี 2550
 * เฉพาะวันที่ 01 และ 16 ของแต่ละเดือน
 * 
 * วันที่เริ่มต้น: คำนวณอัตโนมัติจากวันที่ปัจจุบัน
 * วันที่สิ้นสุด: 16/01/2550
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://lotto.api.rayriffy.com/lotto/';

// รางวัลที่ต้องการดึง
const PRIZE_IDS = [
    'prizeFirst',
    'prizeFirstNear',
    'prizeSecond',
    'prizeThird',
    'prizeForth',
    'prizeFifth'
];

// ปีสิ้นสุด (ปี พ.ศ. ที่ต้องการย้อนหลังไปถึง)
const END_YEAR_BE = 2550;

// จำนวนวันที่ค้นหาสูงสุด (ถ้าวันที่ 1/16 ไม่พบ จะลองหา 2/17, 3/18, ... จนถึง 15 วัน)
const MAX_SEARCH_DAYS = 15;

// สร้าง delay function เพื่อไม่ให้ request ถี่เกินไป
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// แปลงปี ค.ศ. เป็น พ.ศ.
function toBuddhistYear(gregorianYear) {
    return gregorianYear + 543;
}

// ดึงวันที่ปัจจุบันและคำนวณงวดหวยล่าสุด
function getCurrentLottoDate() {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYearBE = toBuddhistYear(now.getFullYear());

    // หวยออกวันที่ 1 และ 16 ของทุกเดือน
    // หาวันออกหวยล่าสุดที่ผ่านมาแล้ว
    let lottoDay, lottoMonth, lottoYear;

    if (currentDay >= 16) {
        // ถ้าวันที่ปัจจุบัน >= 16 งวดล่าสุดคือวันที่ 16 ของเดือนนี้
        lottoDay = 16;
        lottoMonth = currentMonth;
        lottoYear = currentYearBE;
    } else if (currentDay >= 1) {
        // ถ้าวันที่ปัจจุบัน >= 1 แต่ < 16 งวดล่าสุดคือวันที่ 1 ของเดือนนี้
        lottoDay = 1;
        lottoMonth = currentMonth;
        lottoYear = currentYearBE;
    }

    return { day: lottoDay, month: lottoMonth, year: lottoYear };
}

// แปลงวันที่เป็น format DDMMYYYY
function formatDate(day, month, year) {
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();
    return `${dayStr}${monthStr}${yearStr}`;
}

// สร้างรายการงวดหวยทั้งหมดที่ต้องดึง (dynamic)
// return รายการ periods แทน date codes เพื่อรองรับ fallback logic
function generateLottoPeriods() {
    const periods = [];
    const current = getCurrentLottoDate();

    console.log(`📅 วันที่ปัจจุบัน: ${new Date().toLocaleDateString('th-TH')}`);
    console.log(`🎯 งวดล่าสุด: ${current.day}/${current.month}/${current.year}`);
    console.log(`📆 ย้อนหลังถึงปี: พ.ศ. ${END_YEAR_BE}`);
    console.log(`🔍 จะค้นหาสูงสุด ${MAX_SEARCH_DAYS} วันต่องวด ถ้าไม่พบวันออกหวยปกติ`);
    console.log('');

    // เริ่มจากงวดปัจจุบันย้อนหลังไป
    for (let year = current.year; year >= END_YEAR_BE; year--) {
        // กำหนดเดือนเริ่มต้นและสิ้นสุด
        const startMonth = (year === current.year) ? current.month : 12;
        const endMonth = 1;

        for (let month = startMonth; month >= endMonth; month--) {
            // กำหนดวันที่ต้องดึง (baseDay)
            const baseDays = [];

            if (year === current.year && month === current.month) {
                // เดือนปัจจุบัน - ดึงเฉพาะวันที่ผ่านมาแล้ว
                if (current.day >= 16) {
                    baseDays.push(16, 1);
                } else if (current.day >= 1) {
                    baseDays.push(1);
                }
            } else {
                // เดือนอื่นๆ - ดึงทั้งวันที่ 16 และ 1
                baseDays.push(16, 1);
            }

            for (const baseDay of baseDays) {
                periods.push({ baseDay, month, year });
            }
        }
    }

    return periods;
}

// ดึงข้อมูลจาก API ด้วย https module
function fetchLottoData(dateCode) {
    return new Promise((resolve) => {
        const url = `${BASE_URL}${dateCode}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'success' && json.response) {
                        resolve(json.response);
                    } else {
                        resolve(null);
                    }
                } catch (err) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

// ดึงข้อมูลหวยพร้อม fallback ถ้าไม่พบวันที่ 1/16 จะลองหาวันถัดไป
async function fetchLottoWithFallback(baseDay, month, year) {
    // ลองหาตั้งแต่วันที่ base (1 หรือ 16) ไปจนถึง base + MAX_SEARCH_DAYS
    for (let offset = 0; offset < MAX_SEARCH_DAYS; offset++) {
        const tryDay = baseDay + offset;

        // ตรวจสอบว่าวันที่ถูกต้อง (ไม่เกินจำนวนวันในเดือน)
        const daysInMonth = getDaysInMonth(month, year);
        if (tryDay > daysInMonth) break;

        const dateCode = formatDate(tryDay, month, year);
        const response = await fetchLottoData(dateCode);

        if (response) {
            const extracted = extractPrizes(response);
            const hasPrizes = Object.keys(extracted.prizes).length > 0;
            const hasValidDate = response.date && response.date.trim() !== '';

            // ต้องมีทั้ง prizes และ date ที่ถูกต้องถึงจะถือว่าพบข้อมูล
            if (hasPrizes && hasValidDate) {
                return {
                    success: true,
                    data: extracted,
                    actualDate: response.date,
                    triedDays: offset + 1
                };
            }
        }

        await delay(200);
    }

    return { success: false, triedDays: MAX_SEARCH_DAYS };
}

// หาจำนวนวันในเดือน
function getDaysInMonth(month, yearBE) {
    const yearCE = yearBE - 543;
    return new Date(yearCE, month, 0).getDate();
}

// ดึงข้อมูลรางวัลที่ต้องการ
function extractPrizes(response) {
    const extracted = {
        date: response.date || '',
        prizes: {}
    };

    if (!response.prizes || !Array.isArray(response.prizes)) {
        return extracted;
    }

    for (const prize of response.prizes) {
        if (PRIZE_IDS.includes(prize.id)) {
            extracted.prizes[prize.id] = {
                name: prize.name,
                reward: prize.reward,
                numbers: prize.number || []
            };
        }
    }

    return extracted;
}

// โครงสร้างผลลัพธ์แยกตามประเภทรางวัล
function organizeByPrizeType(allData) {
    const organized = {
        metadata: {
            generatedAt: new Date().toISOString(),
            totalDraws: allData.length,
            dateRange: {
                // from = งวดเก่าสุด (index สุดท้าย), to = งวดใหม่สุด (index แรก)
                from: allData.length > 0 ? allData[allData.length - 1].date : null,
                to: allData.length > 0 ? allData[0].date : null
            }
        },
        prizeFirst: { name: 'รางวัลที่ 1', reward: '6000000', draws: [] },
        prizeFirstNear: { name: 'รางวัลข้างเคียงรางวัลที่ 1', reward: '100000', draws: [] },
        prizeSecond: { name: 'รางวัลที่ 2', reward: '200000', draws: [] },
        prizeThird: { name: 'รางวัลที่ 3', reward: '80000', draws: [] },
        prizeForth: { name: 'รางวัลที่ 4', reward: '40000', draws: [] },
        prizeFifth: { name: 'รางวัลที่ 5', reward: '20000', draws: [] }
    };

    for (const data of allData) {
        for (const prizeId of PRIZE_IDS) {
            if (data.prizes?.[prizeId]?.numbers?.length > 0) {
                organized[prizeId].draws.push({
                    date: data.date,
                    numbers: data.prizes[prizeId].numbers
                });
            }
        }
    }

    return organized;
}

// ฟังก์ชันหลัก
async function main() {
    console.log('🎰 สคริปต์ดึงข้อมูลหวยไทย (Dynamic Date with Fallback)');
    console.log('='.repeat(50));
    console.log('');

    const periods = generateLottoPeriods();
    console.log(`📊 จำนวนงวดที่ต้องดึง: ${periods.length} งวด`);
    console.log('');

    const allData = [];
    let successCount = 0;
    let failCount = 0;
    let fallbackCount = 0; // นับจำนวนครั้งที่ต้องใช้ fallback

    for (let i = 0; i < periods.length; i++) {
        const { baseDay, month, year } = periods[i];
        const baseDateStr = formatDate(baseDay, month, year);
        process.stdout.write(`\r🔄 กำลังดึงข้อมูล: ${i + 1}/${periods.length} (${baseDateStr})`);

        const result = await fetchLottoWithFallback(baseDay, month, year);

        if (result.success) {
            allData.push(result.data);
            successCount++;

            // แสดงข้อมูลว่าพบวันที่ไหน
            if (result.triedDays > 1) {
                console.log(` ✅ ${result.actualDate} (เลื่อน +${result.triedDays - 1} วัน)`);
                fallbackCount++;
            } else {
                console.log(` ✅ ${result.actualDate}`);
            }
        } else {
            failCount++;
            console.log(` ⚠️ ไม่พบข้อมูล (ลองแล้ว ${result.triedDays} วัน)`);
        }
    }

    console.log('\n');
    console.log('='.repeat(50));
    console.log('📈 สรุปผล:');
    console.log(`   ✅ ดึงข้อมูลสำเร็จ: ${successCount} งวด`);
    console.log(`   🔄 ใช้ fallback (เลื่อนวัน): ${fallbackCount} งวด`);
    console.log(`   ⚠️ ไม่พบข้อมูล: ${failCount} งวด`);
    console.log('');

    // จัดกลุ่มตามประเภทรางวัล
    const organizedData = organizeByPrizeType(allData);

    console.log('📊 จำนวน draws ในแต่ละรางวัล:');
    for (const prizeId of PRIZE_IDS) {
        console.log(`   ${prizeId}: ${organizedData[prizeId].draws.length} งวด`);
    }
    console.log('');

    // เขียนไฟล์ผลลัพธ์
    const outputPath = path.join(__dirname, 'example2.json');
    fs.writeFileSync(outputPath, JSON.stringify(organizedData, null, 4), 'utf-8');

    console.log(`💾 บันทึกข้อมูลไปที่: ${outputPath}`);
    console.log('🎉 เสร็จสิ้น!');
}

// รันโปรแกรม
main().catch(console.error);
