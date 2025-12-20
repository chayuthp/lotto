/**
 * Thai Lottery Random Number Generator
 * สุ่มเลข 6 ตัวที่ไม่เคยออกรางวัลมาก่อน
 */

class LotteryRandomizer {
    constructor() {
        this.data = null;
        this.existingNumbers = new Set(); // เก็บเลขทั้งหมดที่เคยออกรางวัล
        this.history = [];
        this.isSpinning = false;

        this.prizeNames = {
            prizeFirst: 'รางวัลที่ 1',
            prizeFirstNear: 'รางวัลข้างเคียงรางวัลที่ 1',
            prizeSecond: 'รางวัลที่ 2',
            prizeThird: 'รางวัลที่ 3',
            prizeForth: 'รางวัลที่ 4',
            prizeFifth: 'รางวัลที่ 5'
        };

        this.prizeCategories = ['prizeFirst', 'prizeFirstNear', 'prizeSecond', 'prizeThird', 'prizeForth', 'prizeFifth'];

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.createParticles();
        this.loadFromLocalStorage();
        this.updateStats();
        this.displayLatestResults();
    }

    async loadData() {
        try {
            const response = await fetch('example2.json');
            if (!response.ok) throw new Error('Failed to load data');

            this.data = await response.json();
            this.extractAllExistingNumbers();
            this.showToast('โหลดข้อมูลสำเร็จ ✅', false);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('ไม่สามารถโหลดข้อมูลได้ ❌', true);
        }
    }

    /**
     * ดึงเลขทั้งหมดที่เคยออกรางวัลจากทุกประเภท
     * เก็บใน Set เพื่อเช็คว่าเลขที่สุ่มซ้ำหรือไม่
     */
    extractAllExistingNumbers() {
        this.existingNumbers = new Set();

        for (const prizeKey of this.prizeCategories) {
            if (this.data[prizeKey] && this.data[prizeKey].draws) {
                for (const draw of this.data[prizeKey].draws) {
                    for (const number of draw.numbers) {
                        this.existingNumbers.add(number);
                    }
                }
            }
        }

        console.log(`พบเลขที่เคยออกรางวัล ${this.existingNumbers.size} เลข (ไม่ซ้ำ)`);
    }

    /**
     * สุ่มเลข 6 ตัว (000000 - 999999)
     */
    generateRandomNumber() {
        const num = Math.floor(Math.random() * 1000000);
        return num.toString().padStart(6, '0');
    }

    /**
     * เช็คว่าเลขนี้เคยออกรางวัลหรือไม่
     */
    isNumberExists(number) {
        return this.existingNumbers.has(number);
    }

    /**
     * เช็คว่าเป็นเลขน้อยเกินไป (000000 - 100000)
     */
    isLowNumber(number) {
        const num = parseInt(number, 10);
        return num <= 100000;
    }

    /**
     * เช็คว่าเป็นเลขเบิ้ล (ตัวเลขซ้ำกันทั้งหมด เช่น 111111, 222222)
     */
    isAllSameDigits(number) {
        return /^(\d)\1{5}$/.test(number);
    }

    /**
     * เช็คว่าเป็นเลขเบิ้ลคู่ (เช่น 112233, 445566, 001122)
     */
    isDoublePattern(number) {
        // เช็ค pattern AA BB CC
        if (/^(\d)\1(\d)\2(\d)\3$/.test(number)) return true;
        // เช็ค pattern AAA BBB
        if (/^(\d)\1\1(\d)\2\2$/.test(number)) return true;
        // เช็ค pattern AABB CC หรือ AA BBCC
        if (/^(\d)\1(\d)\2(\d)\3$/.test(number)) return true;
        return false;
    }

    /**
     * เช็คว่าเป็นเลขเรียงสวย (เช่น 123456, 654321, 012345)
     */
    isSequentialNumber(number) {
        const digits = number.split('').map(Number);

        // เช็คเลขเรียงขึ้น (0,1,2,3,4,5 หรือ 1,2,3,4,5,6 ฯลฯ)
        let isAscending = true;
        for (let i = 1; i < digits.length; i++) {
            if (digits[i] !== (digits[i - 1] + 1) % 10) {
                isAscending = false;
                break;
            }
        }

        // เช็คเลขเรียงลง (9,8,7,6,5,4 หรือ 6,5,4,3,2,1 ฯลฯ)
        let isDescending = true;
        for (let i = 1; i < digits.length; i++) {
            if (digits[i] !== (digits[i - 1] - 1 + 10) % 10) {
                isDescending = false;
                break;
            }
        }

        return isAscending || isDescending;
    }

    /**
     * เช็คว่าเป็นเลข pattern พิเศษ (เช่น 121212, 131313, 252525)
     */
    isRepeatingPattern(number) {
        // Pattern AB AB AB
        if (/^(\d\d)\1\1$/.test(number)) return true;
        // Pattern ABC ABC
        if (/^(\d{3})\1$/.test(number)) return true;
        // Pattern A B A B A B
        if (/^(\d)(\d)\1\2\1\2$/.test(number)) return true;
        return false;
    }

    /**
     * เช็คว่าเป็นเลขคู่เรียง (เช่น 024680, 246802, 468024)
     */
    isEvenSequence(number) {
        const evenDigits = ['0', '2', '4', '6', '8'];
        const digits = number.split('');

        // เช็คว่าทุกตัวเป็นเลขคู่
        const allEven = digits.every(d => evenDigits.includes(d));
        if (!allEven) return false;

        // เช็คว่าเป็น pattern เรียง (0,2,4,6,8,0 หรือ 2,4,6,8,0,2 ฯลฯ)
        for (let i = 1; i < digits.length; i++) {
            const prev = parseInt(digits[i - 1]);
            const curr = parseInt(digits[i]);
            // เลขคู่ถัดไปคือ +2 หรือ wrap (8 -> 0)
            if (curr !== (prev + 2) % 10) {
                return false;
            }
        }
        return true;
    }

    /**
     * เช็คว่าเป็นเลขคี่เรียง (เช่น 135791, 357913, 579135)
     */
    isOddSequence(number) {
        const oddDigits = ['1', '3', '5', '7', '9'];
        const digits = number.split('');

        // เช็คว่าทุกตัวเป็นเลขคี่
        const allOdd = digits.every(d => oddDigits.includes(d));
        if (!allOdd) return false;

        // เช็คว่าเป็น pattern เรียง (1,3,5,7,9,1 หรือ 3,5,7,9,1,3 ฯลฯ)
        for (let i = 1; i < digits.length; i++) {
            const prev = parseInt(digits[i - 1]);
            const curr = parseInt(digits[i]);
            // เลขคี่ถัดไปคือ +2 หรือ wrap (9 -> 1)
            const expected = prev === 9 ? 1 : prev + 2;
            if (curr !== expected) {
                return false;
            }
        }
        return true;
    }

    /**
     * เช็คว่าเป็นเลขหาร 3 ลงตัว (สูตรคูณแม่ 3)
     */
    isDivisibleByThree(number) {
        const num = parseInt(number, 10);
        return num % 3 === 0;
    }

    /**
     * เช็คว่าเลขนี้เป็นเลขที่ออกยาก (ควรหลีกเลี่ยง)
     */
    isHardToWinNumber(number) {
        return this.isLowNumber(number) ||
            this.isAllSameDigits(number) ||
            this.isDoublePattern(number) ||
            this.isSequentialNumber(number) ||
            this.isRepeatingPattern(number) ||
            this.isEvenSequence(number) ||
            this.isOddSequence(number) ||
            this.isDivisibleByThree(number);
    }

    /**
     * สุ่มเลขที่ไม่เคยออกรางวัลมาก่อน และไม่ใช่เลขที่ออกยาก
     * ถ้าซ้ำหรือเป็นเลขยากจะสุ่มใหม่จนกว่าจะได้เลขที่ดี
     */
    generateUniqueNumber() {
        let attempts = 0;
        let number;
        let skippedHardNumbers = 0;

        do {
            number = this.generateRandomNumber();
            attempts++;

            // นับเลขที่ถูก skip เพราะเป็นเลขยาก
            if (this.isHardToWinNumber(number)) {
                skippedHardNumbers++;
            }

            // ป้องกัน infinite loop (ถ้าเลือก > 1 ล้านครั้ง)
            if (attempts > 1000000) {
                console.warn('Too many attempts, returning last number');
                break;
            }
        } while (this.isNumberExists(number) || this.isHardToWinNumber(number));

        console.log(`สุ่มได้เลข ${number} หลังจากลอง ${attempts} ครั้ง (ข้ามเลขยาก ${skippedHardNumbers} เลข)`);
        return { number, attempts, skippedHardNumbers };
    }

    setupEventListeners() {
        // Random button
        document.getElementById('randomBtn').addEventListener('click', () => {
            this.randomize();
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.reset();
        });

        // Clear history button
        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            this.clearHistory();
        });

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isSpinning) {
                e.preventDefault();
                this.randomize();
            }
        });
    }

    async randomize() {
        if (this.isSpinning) return;

        this.isSpinning = true;
        const randomBtn = document.getElementById('randomBtn');
        randomBtn.disabled = true;

        // สุ่มเลขที่ไม่ซ้ำกับเลขที่เคยออกรางวัล
        const result = this.generateUniqueNumber();

        // Animate slots
        await this.animateSlots(result.number);

        // เช็คว่าถูกรางวัลที่ 1 หรือไม่
        const prizeWon = this.checkPrizeFirst(result.number);

        if (prizeWon) {
            // แสดงความยินดีพร้อมพลุ
            this.showCelebration(prizeWon);
        }

        // Add to history
        this.addToHistory({
            number: result.number,
            attempts: result.attempts,
            timestamp: new Date().toLocaleString('th-TH'),
            won: prizeWon ? true : false
        });

        // Show result info
        this.showResultInfo(result, prizeWon);

        // Update stats
        this.updateStats();

        // Save to local storage
        this.saveToLocalStorage();

        this.isSpinning = false;
        randomBtn.disabled = false;
    }

    async animateSlots(finalNumber) {
        const slots = document.querySelectorAll('.slot');
        const digits = finalNumber.split('');

        // Hide result info
        document.getElementById('resultInfo').classList.remove('show');

        // Spinning animation
        for (let round = 0; round < 15; round++) {
            for (let i = 0; i < slots.length; i++) {
                slots[i].textContent = Math.floor(Math.random() * 10);
                slots[i].classList.remove('active');
            }
            await this.sleep(50 + round * 10);
        }

        // Reveal final numbers one by one
        for (let i = 0; i < digits.length; i++) {
            await this.sleep(100);
            slots[i].textContent = digits[i];
            slots[i].classList.add('active');

            // Create burst effect
            this.createBurst(slots[i]);
        }
    }

    createBurst(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'burst-particle';
            particle.style.cssText = `
                position: fixed;
                width: 8px;
                height: 8px;
                background: linear-gradient(135deg, #ffd700, #ff8c00);
                border-radius: 50%;
                left: ${centerX}px;
                top: ${centerY}px;
                pointer-events: none;
                z-index: 1000;
                animation: burstOut 0.5s ease-out forwards;
                --angle: ${(i * 45)}deg;
            `;
            document.body.appendChild(particle);

            setTimeout(() => particle.remove(), 500);
        }
    }

    showResultInfo(result, prizeWon = null) {
        const resultInfo = document.getElementById('resultInfo');
        resultInfo.querySelector('.result-date').textContent = `🔄 ลองสุ่ม ${result.attempts} ครั้ง`;

        if (prizeWon) {
            resultInfo.querySelector('.result-prize').textContent = `🎉 ถูกรางวัลที่ 1! งวด ${prizeWon.date}`;
            resultInfo.querySelector('.result-prize').style.color = '#ffd700';
        } else {
            resultInfo.querySelector('.result-prize').textContent = `✅ เลขนี้ไม่เคยออกรางวัลมาก่อน!`;
            resultInfo.querySelector('.result-prize').style.color = '';
        }

        resultInfo.classList.add('show');
    }

    addToHistory(item) {
        this.history.unshift(item);

        // จำกัดประวัติไม่เกิน 50 รายการ
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }

        this.renderHistory();
    }

    renderHistory() {
        const historyList = document.getElementById('historyList');
        const historyCount = document.getElementById('historyCount');

        historyCount.textContent = this.history.length;

        if (this.history.length === 0) {
            historyList.innerHTML = '<p class="history-empty">ยังไม่มีประวัติการสุ่ม</p>';
            return;
        }

        historyList.innerHTML = this.history.map((item, index) => `
            <div class="history-item" style="animation-delay: ${index * 0.05}s">
                <span class="history-number">${item.number}</span>
                <div class="history-details">
                    <span class="history-prize-name">🔄 ${item.attempts} ครั้ง</span>
                    <span class="history-date">${item.timestamp}</span>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        const totalExisting = this.existingNumbers.size;
        const totalDraws = this.data?.metadata?.totalDraws || 0;
        const totalPossible = 1000000; // 000000 - 999999
        const remaining = totalPossible - totalExisting;

        document.getElementById('totalNumbers').textContent = totalExisting.toLocaleString();
        document.getElementById('totalDraws').textContent = totalDraws.toLocaleString();
        document.getElementById('remainingNumbers').textContent = remaining.toLocaleString();
    }

    reset() {
        // Reset slots
        document.querySelectorAll('.slot').forEach(slot => {
            slot.textContent = '-';
            slot.classList.remove('active');
        });

        document.getElementById('resultInfo').classList.remove('show');

        this.showToast('รีเซ็ตหน้าจอเรียบร้อย 🔄', false);
    }

    clearHistory() {
        this.history = [];
        this.renderHistory();
        this.saveToLocalStorage();
        this.showToast('ล้างประวัติเรียบร้อย 🗑️', false);
    }

    saveToLocalStorage() {
        const data = {
            history: this.history
        };
        localStorage.setItem('lotteryRandomizer', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('lotteryRandomizer');
            if (saved) {
                const data = JSON.parse(saved);
                this.history = data.history || [];
                this.renderHistory();
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
        }
    }

    createParticles() {
        const container = document.getElementById('particles');
        const colors = ['#ffd700', '#9d4edd', '#00d4ff', '#ff006e', '#00ff87'];

        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                left: ${Math.random() * 100}%;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                animation-delay: ${Math.random() * 4}s;
                animation-duration: ${4 + Math.random() * 4}s;
            `;
            container.appendChild(particle);
        }
    }

    showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = toast.querySelector('.toast-icon');

        toastMessage.textContent = message;
        toastIcon.textContent = isError ? '⚠️' : '✅';
        toast.classList.toggle('error', isError);
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * แสดงผลหวยล่าสุดจากข้อมูล JSON
     */
    displayLatestResults() {
        if (!this.data) return;

        // หาวันที่ล่าสุดจากรางวัลที่ 1
        const latestDraw = this.data.prizeFirst?.draws?.[0];
        if (latestDraw) {
            document.getElementById('latestDate').textContent = `📅 ${latestDraw.date}`;
        }

        // แสดงแต่ละรางวัล
        this.renderPrizeNumbers('prizeFirst', 'prizeFirstNumbers');
        this.renderPrizeNumbers('prizeFirstNear', 'prizeFirstNearNumbers');
        this.renderPrizeNumbers('prizeSecond', 'prizeSecondNumbers');
        this.renderPrizeNumbers('prizeThird', 'prizeThirdNumbers');
        this.renderPrizeNumbers('prizeForth', 'prizeFourthNumbers');
        this.renderPrizeNumbers('prizeFifth', 'prizeFifthNumbers');
    }

    /**
     * แสดงเลขรางวัลในแต่ละประเภท
     */
    renderPrizeNumbers(prizeKey, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        const prizeData = this.data[prizeKey];
        if (!prizeData || !prizeData.draws || prizeData.draws.length === 0) {
            container.innerHTML = '<span class="number">-</span>';
            return;
        }

        // ดึงเลขจากงวดล่าสุด
        const latestNumbers = prizeData.draws[0].numbers;

        container.innerHTML = latestNumbers.map(num =>
            `<span class="number">${num}</span>`
        ).join('');
    }

    /**
     * เช็คว่าเลขที่สุ่มได้ตรงกับรางวัลที่ 1 หรือไม่
     */
    checkPrizeFirst(number) {
        if (!this.data || !this.data.prizeFirst || !this.data.prizeFirst.draws) {
            return null;
        }

        for (const draw of this.data.prizeFirst.draws) {
            if (draw.numbers.includes(number)) {
                return {
                    date: draw.date,
                    number: number
                };
            }
        }
        return null;
    }

    /**
     * แสดงความยินดีพร้อมเอฟเฟกต์พลุ
     */
    showCelebration(prizeWon) {
        // สร้าง overlay
        const overlay = document.createElement('div');
        overlay.className = 'celebration-overlay';
        overlay.innerHTML = `
            <div class="celebration-content">
                <div class="fireworks-container" id="fireworksContainer"></div>
                <div class="celebration-box">
                    <div class="celebration-icon">🎉</div>
                    <h2 class="celebration-title">ยินดีด้วย!</h2>
                    <p class="celebration-subtitle">เลขที่คุณสุ่มได้ตรงกับ</p>
                    <div class="celebration-prize">รางวัลที่ 1</div>
                    <div class="celebration-number">${prizeWon.number}</div>
                    <div class="celebration-date">งวดวันที่ ${prizeWon.date}</div>
                    <div class="celebration-reward">💰 6,000,000 บาท</div>
                    <button class="celebration-close" onclick="this.closest('.celebration-overlay').remove()">
                        ปิด
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // เริ่มเอฟเฟกต์พลุ
        this.launchFireworks();

        // ปิดอัตโนมัติหลัง 10 วินาที
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 10000);
    }

    /**
     * สร้างเอฟเฟกต์พลุ
     */
    launchFireworks() {
        const container = document.getElementById('fireworksContainer');
        if (!container) return;

        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#ff006e', '#00ff87', '#f9ca24', '#ff9ff3'];

        // สร้างพลุหลายชุด
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                this.createFirework(container, colors);
            }, i * 200);
        }
    }

    /**
     * สร้างพลุหนึ่งลูก
     */
    createFirework(container, colors) {
        const x = Math.random() * 100;
        const y = Math.random() * 60 + 10;
        const color = colors[Math.floor(Math.random() * colors.length)];

        // สร้าง particles สำหรับพลุลูกนี้
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'firework-particle';

            const angle = (i / 30) * 360;
            const velocity = 50 + Math.random() * 50;
            const size = 3 + Math.random() * 5;

            particle.style.cssText = `
                position: absolute;
                left: ${x}%;
                top: ${y}%;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: 50%;
                box-shadow: 0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color};
                --angle: ${angle}deg;
                --velocity: ${velocity}px;
                animation: fireworkExplode 1.5s ease-out forwards;
            `;

            container.appendChild(particle);

            setTimeout(() => particle.remove(), 1500);
        }
    }
}

// CSS for burst particles (injected dynamically)
const burstStyle = document.createElement('style');
burstStyle.textContent = `
    @keyframes burstOut {
        0% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(60px) scale(0);
            opacity: 0;
        }
    }
`;
document.head.appendChild(burstStyle);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new LotteryRandomizer();
});
