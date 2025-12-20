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

// สร้างรายการวันที่ทั้งหมดที่ต้องดึง (dynamic)
function generateDateList() {
    const dates = [];
    const current = getCurrentLottoDate();

    console.log(`📅 วันที่ปัจจุบัน: ${new Date().toLocaleDateString('th-TH')}`);
    console.log(`🎯 งวดล่าสุด: ${current.day}/${current.month}/${current.year}`);
    console.log(`📆 ย้อนหลังถึงปี: พ.ศ. ${END_YEAR_BE}`);
    console.log('');

    // เริ่มจากงวดปัจจุบันย้อนหลังไป
    for (let year = current.year; year >= END_YEAR_BE; year--) {
        // กำหนดเดือนเริ่มต้นและสิ้นสุด
        const startMonth = (year === current.year) ? current.month : 12;
        const endMonth = 1;

        for (let month = startMonth; month >= endMonth; month--) {
            // กำหนดวันที่ต้องดึง
            const daysToFetch = [];

            if (year === current.year && month === current.month) {
                // เดือนปัจจุบัน - ดึงเฉพาะวันที่ผ่านมาแล้ว
                if (current.day >= 16) {
                    daysToFetch.push(16, 1);
                } else if (current.day >= 1) {
                    daysToFetch.push(1);
                }
            } else {
                // เดือนอื่นๆ - ดึงทั้งวันที่ 16 และ 1
                daysToFetch.push(16, 1);
            }

            for (const day of daysToFetch) {
                dates.push(formatDate(day, month, year));
            }
        }
    }

    return dates;
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
    console.log('🎰 สคริปต์ดึงข้อมูลหวยไทย (Dynamic Date)');
    console.log('='.repeat(50));
    console.log('');

    const dates = generateDateList();
    console.log(`📊 จำนวนงวดที่ต้องดึง: ${dates.length} งวด`);
    console.log('');

    const allData = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < dates.length; i++) {
        const dateCode = dates[i];
        process.stdout.write(`\r🔄 กำลังดึงข้อมูล: ${i + 1}/${dates.length} (${dateCode})`);

        const response = await fetchLottoData(dateCode);

        if (response) {
            const extracted = extractPrizes(response);
            const hasPrizes = Object.keys(extracted.prizes).length > 0;

            if (hasPrizes) {
                allData.push(extracted);
                successCount++;
                console.log(` ✅ ${response.date}`);
            } else {
                failCount++;
            }
        } else {
            failCount++;
        }

        await delay(300);
    }

    console.log('\n');
    console.log('='.repeat(50));
    console.log('📈 สรุปผล:');
    console.log(`   ✅ ดึงข้อมูลสำเร็จ: ${successCount} งวด`);
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
