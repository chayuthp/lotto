/**
 * ทดสอบดึงแค่ 2 งวด - export เป็น example3.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const URLS = [
    'https://lotto.api.rayriffy.com/lotto/16122568',
    'https://lotto.api.rayriffy.com/lotto/01122568'
];

const PRIZE_IDS = ['prizeFirst', 'prizeFirstNear', 'prizeSecond', 'prizeThird', 'prizeForth', 'prizeFifth'];

function fetchData(url) {
    return new Promise((resolve, reject) => {
        console.log(`📡 Fetching: ${url}`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'success' && json.response) {
                        console.log(`   ✅ ${json.response.date} - ${json.response.prizes?.length} prizes`);
                        resolve(json.response);
                    } else {
                        resolve(null);
                    }
                } catch (err) {
                    console.log(`   ❌ Error: ${err.message}`);
                    resolve(null);
                }
            });
        }).on('error', err => resolve(null));
    });
}

async function main() {
    console.log('🧪 ทดสอบดึงข้อมูล 2 งวด\n');

    // โครงสร้างผลลัพธ์
    const result = {
        prizeFirst: { name: 'รางวัลที่ 1', reward: '6000000', draws: [] },
        prizeFirstNear: { name: 'รางวัลข้างเคียงรางวัลที่ 1', reward: '100000', draws: [] },
        prizeSecond: { name: 'รางวัลที่ 2', reward: '200000', draws: [] },
        prizeThird: { name: 'รางวัลที่ 3', reward: '80000', draws: [] },
        prizeForth: { name: 'รางวัลที่ 4', reward: '40000', draws: [] },
        prizeFifth: { name: 'รางวัลที่ 5', reward: '20000', draws: [] }
    };

    for (const url of URLS) {
        const response = await fetchData(url);

        if (response && response.prizes) {
            const date = response.date;

            for (const prize of response.prizes) {
                if (PRIZE_IDS.includes(prize.id) && prize.number && prize.number.length > 0) {
                    result[prize.id].draws.push({
                        date: date,
                        numbers: prize.number
                    });
                }
            }
        }
    }

    // แสดงผลสรุป
    console.log('\n📊 ผลลัพธ์:');
    for (const id of PRIZE_IDS) {
        console.log(`   ${id}: ${result[id].draws.length} งวด`);
        if (result[id].draws.length > 0) {
            console.log(`      ตัวอย่าง: ${result[id].draws[0].numbers.slice(0, 3).join(', ')}...`);
        }
    }

    // บันทึกไฟล์
    const outputPath = path.join(__dirname, 'example3.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 4), 'utf-8');
    console.log(`\n💾 บันทึกไปที่: ${outputPath}`);
}

main();
