/**
 * สคริปต์ทดสอบสำหรับดึงข้อมูลหวยไทยจาก API
 * ดึงข้อมูลเฉพาะปี 2568 (1 ปี)
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

// สร้าง delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// แปลงปี พ.ศ. เป็น format DDMMYYYY
function formatDate(day, month, year) {
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString(); // ใช้ปีเต็ม 4 หลัก เช่น 2568
    return `${dayStr}${monthStr}${yearStr}`;
}

// สร้างรายการวันที่ - เฉพาะปี 2568
function generateDateList() {
    const dates = [];
    const year = 2568;

    for (let month = 12; month >= 1; month--) {
        dates.push(formatDate(16, month, year));
        dates.push(formatDate(1, month, year));
    }

    return dates;
}

// ดึงข้อมูลจาก API ด้วย https module
function fetchLottoData(dateCode) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}${dateCode}`;
        console.log(`\n📡 กำลังดึง: ${url}`);

        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`   📥 Status: ${json.status}`);

                    if (json.status === 'success' && json.response) {
                        console.log(`   📅 Date: ${json.response.date}`);
                        console.log(`   🎰 Prizes: ${json.response.prizes ? json.response.prizes.length : 0}`);
                        resolve(json.response);
                    } else {
                        console.log(`   ⚠️ ไม่มีข้อมูล`);
                        resolve(null);
                    }
                } catch (err) {
                    console.log(`   ❌ Parse error: ${err.message}`);
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            console.log(`   ❌ Request error: ${err.message}`);
            resolve(null);
        });
    });
}

// ดึงข้อมูลรางวัลที่ต้องการ
function extractPrizes(response) {
    const extracted = {
        date: response.date || '',
        prizes: {}
    };

    if (!response.prizes || !Array.isArray(response.prizes)) {
        console.log(`   ⚠️ ไม่พบ prizes array`);
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

    console.log(`   ✅ ดึงได้ ${Object.keys(extracted.prizes).length} รางวัล`);
    return extracted;
}

// จัดกลุ่มตามประเภทรางวัล
function organizeByPrizeType(allData) {
    const organized = {
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
    console.log('🎰 ทดสอบดึงข้อมูลหวยไทย (ปี 2568 เท่านั้น)');
    console.log('================================================');

    const dates = generateDateList();
    console.log(`📊 จำนวนวันที่: ${dates.length} วัน\n`);

    const allData = [];
    let successCount = 0;

    // ดึงทีละตัว รอให้เสร็จก่อนค่อยไปตัวถัดไป
    for (let i = 0; i < dates.length; i++) {
        const dateCode = dates[i];
        console.log(`\n--- [${i + 1}/${dates.length}] ---`);

        // รอให้ fetch เสร็จก่อน
        const response = await fetchLottoData(dateCode);

        if (response) {
            const extracted = extractPrizes(response);
            if (Object.keys(extracted.prizes).length > 0) {
                allData.push(extracted);
                successCount++;
            }
        }

        // รอ 500ms ก่อนดึงตัวถัดไป
        await delay(500);
    }

    console.log('\n================================================');
    console.log(`📈 ดึงข้อมูลสำเร็จ: ${successCount} งวด`);

    // แสดงตัวอย่าง
    if (allData.length > 0) {
        console.log('\n🔍 ตัวอย่างข้อมูลงวดแรก:');
        console.log(`   วันที่: ${allData[0].date}`);
        console.log(`   รางวัลที่ 1: ${allData[0].prizes.prizeFirst?.numbers?.[0] || 'ไม่มี'}`);
    }

    // จัดกลุ่มและบันทึก
    const organized = organizeByPrizeType(allData);

    console.log('\n📊 จำนวน draws:');
    for (const id of PRIZE_IDS) {
        console.log(`   ${id}: ${organized[id].draws.length} งวด`);
    }

    const outputPath = path.join(__dirname, 'example2_test.json');
    fs.writeFileSync(outputPath, JSON.stringify(organized, null, 4), 'utf-8');
    console.log(`\n💾 บันทึกไปที่: ${outputPath}`);
}

main().catch(err => {
    console.error('❌ Main error:', err);
});
