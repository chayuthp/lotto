/**
 * สคริปต์สำหรับดึงข้อมูลหวยไทยงวดใหม่ (Incremental Update)
 * ใช้กับ GitHub Actions - ดึงเฉพาะงวดที่ยังไม่มีใน example2.json
 * 
 * หวยออกวันที่ 1 และ 16 ของทุกเดือน
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://lotto.api.rayriffy.com/lotto/';
const DATA_FILE = path.join(__dirname, 'example2.json');

// รางวัลที่ต้องการดึง
const PRIZE_IDS = [
    'prizeFirst',
    'prizeFirstNear',
    'prizeSecond',
    'prizeThird',
    'prizeForth',
    'prizeFifth'
];

// จำนวนวันที่ค้นหาสูงสุด (ถ้าวันที่ 1/16 ไม่พบ จะลองหา 2/17, 3/18, ... จนถึง 31 วัน)
const MAX_SEARCH_DAYS = 31;

// สร้าง delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// แปลงปี ค.ศ. เป็น พ.ศ.
function toBuddhistYear(gregorianYear) {
    return gregorianYear + 543;
}

// แปลงวันที่เป็น format DDMMYYYY
function formatDate(day, month, year) {
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();
    return `${dayStr}${monthStr}${yearStr}`;
}

// หางวดหวยที่ควรมีข้อมูล (งวดปัจจุบันหรืองวดที่ผ่านมา)
// return รายการ periods เพื่อรองรับ fallback logic
function getLatestLottoPeriods() {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYearBE = toBuddhistYear(now.getFullYear());

    const periods = [];

    // งวดปัจจุบันของเดือนนี้
    if (currentDay >= 16) {
        // ถ้าวันที่ >= 16 เช็คทั้งงวดวันที่ 16 และ 1
        periods.push({ baseDay: 16, month: currentMonth, year: currentYearBE });
        periods.push({ baseDay: 1, month: currentMonth, year: currentYearBE });
    } else if (currentDay >= 1) {
        // ถ้าวันที่ >= 1 แต่ < 16 เช็คงวดวันที่ 1
        periods.push({ baseDay: 1, month: currentMonth, year: currentYearBE });
    }

    // เพิ่มงวดเดือนก่อนหน้าด้วย (กันพลาด)
    let prevMonth = currentMonth - 1;
    let prevYear = currentYearBE;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear--;
    }
    periods.push({ baseDay: 16, month: prevMonth, year: prevYear });
    periods.push({ baseDay: 1, month: prevMonth, year: prevYear });

    return periods;
}

// อ่านข้อมูลเดิมจากไฟล์
function loadExistingData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const content = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(content);
        }
    } catch (err) {
        console.error('⚠️ ไม่สามารถอ่านไฟล์ข้อมูลเดิมได้:', err.message);
    }

    // สร้างโครงสร้างว่างถ้าไม่มีไฟล์
    return {
        metadata: {
            generatedAt: new Date().toISOString(),
            totalDraws: 0,
            dateRange: { from: null, to: null }
        },
        prizeFirst: { name: 'รางวัลที่ 1', reward: '6000000', draws: [] },
        prizeFirstNear: { name: 'รางวัลข้างเคียงรางวัลที่ 1', reward: '100000', draws: [] },
        prizeSecond: { name: 'รางวัลที่ 2', reward: '200000', draws: [] },
        prizeThird: { name: 'รางวัลที่ 3', reward: '80000', draws: [] },
        prizeForth: { name: 'รางวัลที่ 4', reward: '40000', draws: [] },
        prizeFifth: { name: 'รางวัลที่ 5', reward: '20000', draws: [] }
    };
}

// เช็คว่าวันที่นี้มีในข้อมูลแล้วหรือยัง
function isDateExists(existingData, dateStr) {
    // เช็คจาก prizeFirst (เพราะทุกงวดต้องมี)
    const draws = existingData.prizeFirst?.draws || [];
    return draws.some(draw => draw.date === dateStr);
}

// ดึงข้อมูลจาก API
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

// หาจำนวนวันในเดือน
function getDaysInMonth(month, yearBE) {
    const yearCE = yearBE - 543;
    return new Date(yearCE, month, 0).getDate();
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

// ดึงข้อมูลรางวัล
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

// เพิ่มข้อมูลใหม่เข้าไปในข้อมูลเดิม
function addNewDraw(existingData, newDraw) {
    for (const prizeId of PRIZE_IDS) {
        if (newDraw.prizes?.[prizeId]?.numbers?.length > 0) {
            const drawData = {
                date: newDraw.date,
                numbers: newDraw.prizes[prizeId].numbers
            };

            // เพิ่มที่ต้นอาร์เรย์ (งวดใหม่สุดอยู่หน้า)
            existingData[prizeId].draws.unshift(drawData);
        }
    }

    // อัพเดท metadata
    existingData.metadata.generatedAt = new Date().toISOString();
    existingData.metadata.totalDraws = existingData.prizeFirst.draws.length;

    if (existingData.prizeFirst.draws.length > 0) {
        // from = งวดเก่าสุด (index สุดท้าย), to = งวดใหม่สุด (index แรก)
        existingData.metadata.dateRange.from = existingData.prizeFirst.draws[existingData.prizeFirst.draws.length - 1].date;
        existingData.metadata.dateRange.to = existingData.prizeFirst.draws[0].date;
    }

    return existingData;
}

// ฟังก์ชันหลัก
async function main() {
    console.log('🎰 สคริปต์อัพเดทข้อมูลหวยไทย (Incremental with Fallback)');
    console.log('='.repeat(50));
    console.log(`📅 วันที่รัน: ${new Date().toLocaleString('th-TH')}`);
    console.log(`🔍 จะค้นหาสูงสุด ${MAX_SEARCH_DAYS} วันต่องวด ถ้าไม่พบวันออกหวยปกติ`);
    console.log('');

    // โหลดข้อมูลเดิม
    let existingData = loadExistingData();
    console.log(`📊 ข้อมูลเดิม: ${existingData.metadata.totalDraws} งวด`);

    // หางวดที่ควรเช็ค
    const periodsToCheck = getLatestLottoPeriods();
    const periodsDisplay = periodsToCheck.map(p => `${p.baseDay}/${p.month}/${p.year}`).join(', ');
    console.log(`🔍 เช็คงวด: ${periodsDisplay}`);
    console.log('');

    let newDrawsCount = 0;
    let fallbackCount = 0;

    for (const period of periodsToCheck) {
        const { baseDay, month, year } = period;
        const baseDateStr = `${baseDay.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;

        console.log(`🔄 กำลังดึงข้อมูลงวด ${baseDateStr}...`);

        const result = await fetchLottoWithFallback(baseDay, month, year);

        if (result.success) {
            // เช็คว่ามีข้อมูลแล้วหรือยัง (ใช้ actualDate ที่ได้)
            if (isDateExists(existingData, result.actualDate)) {
                if (result.triedDays > 1) {
                    console.log(`   ⏭️ ${result.actualDate} - มีข้อมูลแล้ว (เลื่อน +${result.triedDays - 1} วัน)`);
                } else {
                    console.log(`   ⏭️ ${result.actualDate} - มีข้อมูลแล้ว`);
                }
                continue;
            }

            existingData = addNewDraw(existingData, result.data);
            newDrawsCount++;

            if (result.triedDays > 1) {
                console.log(`   ✅ เพิ่มข้อมูลงวด ${result.actualDate} สำเร็จ! (เลื่อน +${result.triedDays - 1} วัน)`);
                fallbackCount++;
            } else {
                console.log(`   ✅ เพิ่มข้อมูลงวด ${result.actualDate} สำเร็จ!`);
            }
        } else {
            console.log(`   ⚠️ งวด ${baseDateStr} - ไม่พบข้อมูล (ลองแล้ว ${result.triedDays} วัน)`);
        }
    }

    console.log('');
    console.log('='.repeat(50));

    if (newDrawsCount > 0) {
        // บันทึกไฟล์
        fs.writeFileSync(DATA_FILE, JSON.stringify(existingData, null, 4), 'utf-8');
        console.log(`💾 เพิ่มข้อมูลใหม่ ${newDrawsCount} งวด`);
        console.log(`📊 ข้อมูลรวม: ${existingData.metadata.totalDraws} งวด`);
        console.log(`📁 บันทึกไปที่: ${DATA_FILE}`);
    } else {
        console.log('📭 ไม่มีข้อมูลใหม่ที่ต้องอัพเดท');
    }

    console.log('🎉 เสร็จสิ้น!');

    // Return exit code สำหรับ GitHub Actions
    process.exit(newDrawsCount > 0 ? 0 : 0);
}

// รันโปรแกรม
main().catch(err => {
    console.error('❌ เกิดข้อผิดพลาด:', err);
    process.exit(1);
});
