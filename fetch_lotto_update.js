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
function getLatestLottoDates() {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYearBE = toBuddhistYear(now.getFullYear());

    const dates = [];

    // งวดปัจจุบันของเดือนนี้
    if (currentDay >= 16) {
        // ถ้าวันที่ >= 16 เช็คทั้งงวดวันที่ 16 และ 1
        dates.push(formatDate(16, currentMonth, currentYearBE));
        dates.push(formatDate(1, currentMonth, currentYearBE));
    } else if (currentDay >= 1) {
        // ถ้าวันที่ >= 1 แต่ < 16 เช็คงวดวันที่ 1
        dates.push(formatDate(1, currentMonth, currentYearBE));
    }

    // เพิ่มงวดเดือนก่อนหน้าด้วย (กันพลาด)
    let prevMonth = currentMonth - 1;
    let prevYear = currentYearBE;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear--;
    }
    dates.push(formatDate(16, prevMonth, prevYear));
    dates.push(formatDate(1, prevMonth, prevYear));

    return dates;
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
        existingData.metadata.dateRange.from = existingData.prizeFirst.draws[0].date;
        existingData.metadata.dateRange.to = existingData.prizeFirst.draws[existingData.prizeFirst.draws.length - 1].date;
    }

    return existingData;
}

// ฟังก์ชันหลัก
async function main() {
    console.log('🎰 สคริปต์อัพเดทข้อมูลหวยไทย (Incremental)');
    console.log('='.repeat(50));
    console.log(`📅 วันที่รัน: ${new Date().toLocaleString('th-TH')}`);
    console.log('');

    // โหลดข้อมูลเดิม
    let existingData = loadExistingData();
    console.log(`📊 ข้อมูลเดิม: ${existingData.metadata.totalDraws} งวด`);

    // หางวดที่ควรเช็ค
    const datesToCheck = getLatestLottoDates();
    console.log(`🔍 เช็คงวด: ${datesToCheck.join(', ')}`);
    console.log('');

    let newDrawsCount = 0;

    for (const dateCode of datesToCheck) {
        // แปลง dateCode เป็นรูปแบบวันที่อ่านง่าย
        const day = dateCode.substring(0, 2);
        const month = dateCode.substring(2, 4);
        const year = dateCode.substring(4);
        const readableDate = `${day}/${month}/${year}`;

        // เช็คว่ามีข้อมูลแล้วหรือยัง
        if (isDateExists(existingData, readableDate)) {
            console.log(`⏭️ งวด ${readableDate} - มีข้อมูลแล้ว`);
            continue;
        }

        console.log(`🔄 กำลังดึงข้อมูลงวด ${readableDate}...`);

        const response = await fetchLottoData(dateCode);

        if (response) {
            const extracted = extractPrizes(response);
            const hasPrizes = Object.keys(extracted.prizes).length > 0;

            if (hasPrizes) {
                existingData = addNewDraw(existingData, extracted);
                newDrawsCount++;
                console.log(`✅ เพิ่มข้อมูลงวด ${extracted.date} สำเร็จ!`);
            } else {
                console.log(`⚠️ งวด ${readableDate} - ไม่พบข้อมูลรางวัล`);
            }
        } else {
            console.log(`⚠️ งวด ${readableDate} - ยังไม่มีข้อมูล (อาจยังไม่ออก)`);
        }

        await delay(500);
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
