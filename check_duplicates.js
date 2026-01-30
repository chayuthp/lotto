const fs = require('fs');
const data = require('./example2.json');

let output = '';
const log = (msg) => { output += msg + '\n'; console.log(msg); };

// รวบรวมเลขรางวัลที่ 1 ทั้งหมด
const prizeFirstNumbers = new Set();
data.prizeFirst.draws.forEach(d => d.numbers.forEach(n => prizeFirstNumbers.add(n)));

log('==================================================');
log('Check: prizeFirst duplicates with other prizes');
log('==================================================');
log('');
log('prizeFirst has ' + prizeFirstNumbers.size + ' numbers (from ' + data.prizeFirst.draws.length + ' draws)');
log('');

const prizes = ['prizeFirstNear', 'prizeSecond', 'prizeThird', 'prizeForth', 'prizeFifth'];

prizes.forEach(p => {
    const duplicates = [];
    data[p].draws.forEach(d => {
        d.numbers.forEach(n => {
            if (prizeFirstNumbers.has(n)) {
                duplicates.push({ date: d.date, number: n });
            }
        });
    });

    if (duplicates.length > 0) {
        log(p + ': ' + duplicates.length + ' duplicates found');
        duplicates.forEach(x => log('   - ' + x.number + ' (' + x.date + ')'));
    } else {
        log(p + ': No duplicates');
    }
});

log('');
log('==================================================');

fs.writeFileSync('check_result.txt', output, 'utf8');
console.log('Result saved to check_result.txt');
