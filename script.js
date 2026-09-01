// ============================================================
// ENGLISH LEARNING APP - Main JavaScript
// Complete implementation for personal use
// ============================================================

// ============================================================
// DATA & STATE MANAGEMENT
// ============================================================

const APP_KEY = 'englishLearning';

// Default state
const defaultState = {
    profilUser: {
        tanggalMulai: new Date().toISOString(),
        level: 'A1',
        totalPoin: 0
    },
    energiHarian: {
        tanggal: new Date().toISOString().split('T')[0],
        sisaEnergi: 5,
        alokasiTerpakai: {
            'vocab-grammar': 0,
            'listening': 0,
            'speaking': 0,
            'free': 0
        }
    },
    progresItem: [],
    riwayatSesi: [],
    learningHealthScore: {
        tanggal: new Date().toISOString().split('T')[0],
        akurasi: 0,
        retensi: 0,
        konsistensi: 0,
        progresLevel: 0,
        skorTotal: 0
    },
    streak: {
        streakSaatIni: 0,
        tanggalTerakhirAktif: null,
        jumlahBekuTersisa: 1
    },
    bestStreak: 0
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getState() {
    try {
        const data = localStorage.getItem(APP_KEY);
        if (!data) {
            localStorage.setItem(APP_KEY, JSON.stringify(defaultState));
            return JSON.parse(JSON.stringify(defaultState));
        }
        const parsed = JSON.parse(data);
        // Merge with default to ensure all keys exist
        return deepMerge(defaultState, parsed);
    } catch (e) {
        console.error('Error loading state:', e);
        return JSON.parse(JSON.stringify(defaultState));
    }
}

function saveState(state) {
    try {
        localStorage.setItem(APP_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

function deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target));
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                result[key] = deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
    }
    return result;
}

function getToday() {
    return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================
// ENERGY SYSTEM
// ============================================================

function checkResetEnergy(state) {
    const today = getToday();
    if (state.energiHarian.tanggal !== today) {
        state.energiHarian.tanggal = today;
        state.energiHarian.sisaEnergi = 5;
        state.energiHarian.alokasiTerpakai = {
            'vocab-grammar': 0,
            'listening': 0,
            'speaking': 0,
            'free': 0
        };
        saveState(state);
    }
    return state;
}

function useEnergy(state, skill, amount = 1) {
    const today = getToday();
    if (state.energiHarian.tanggal !== today) {
        checkResetEnergy(state);
    }
    
    if (state.energiHarian.sisaEnergi < amount) {
        return { success: false, message: 'Energi tidak mencukupi!' };
    }
    
    state.energiHarian.sisaEnergi -= amount;
    if (state.energiHarian.alokasiTerpakai[skill] !== undefined) {
        state.energiHarian.alokasiTerpakai[skill] += amount;
    }
    saveState(state);
    return { success: true, message: 'Energi berhasil digunakan' };
}

function getAvailableEnergy(state) {
    checkResetEnergy(state);
    return state.energiHarian.sisaEnergi;
}

// ============================================================
// SPACED REPETITION SYSTEM
// ============================================================

const INTERVALS = [1, 3, 7, 14, 30, 60]; // days

function getNextInterval(currentInterval, isCorrect) {
    if (isCorrect) {
        // Move to next interval (cap at max)
        const nextIdx = Math.min(currentInterval + 1, INTERVALS.length - 1);
        return nextIdx;
    } else {
        // Reset to first interval (review tomorrow)
        return 0;
    }
}

function getReviewDate(intervalIndex) {
    const d = new Date();
    d.setDate(d.getDate() + INTERVALS[intervalIndex]);
    return d.toISOString().split('T')[0];
}

function getDueItems(state, questions) {
    const today = getToday();
    const due = [];
    const itemMap = {};
    
    // Create map for quick lookup
    questions.forEach(q => {
        itemMap[q.id] = q;
    });
    
    state.progresItem.forEach(item => {
        if (item.tanggalUlangBerikutnya && item.tanggalUlangBerikutnya <= today) {
            const q = itemMap[item.idSoal];
            if (q) {
                due.push({
                    ...item,
                    question: q
                });
            }
        }
    });
    
    return due;
}

function updateItemProgress(state, itemId, isCorrect) {
    const item = state.progresItem.find(i => i.idSoal === itemId);
    if (item) {
        const newIntervalIdx = getNextInterval(item.intervalKe || 0, isCorrect);
        item.intervalKe = newIntervalIdx;
        item.tanggalTerakhirDiulang = getToday();
        item.tanggalUlangBerikutnya = getReviewDate(newIntervalIdx);
        item.statusBenarTerakhir = isCorrect;
        // Increment review count
        item.jumlahReview = (item.jumlahReview || 0) + 1;
        item.jumlahBenar = (item.jumlahBenar || 0) + (isCorrect ? 1 : 0);
    } else {
        // New item - first learning
        state.progresItem.push({
            idSoal: itemId,
            intervalKe: 1,
            tanggalTerakhirDiulang: getToday(),
            tanggalUlangBerikutnya: getReviewDate(1),
            statusBenarTerakhir: isCorrect,
            jumlahReview: 1,
            jumlahBenar: isCorrect ? 1 : 0,
            pertamaDipelajari: getToday()
        });
    }
    saveState(state);
}

// ============================================================
// LEARNING HEALTH SCORE
// ============================================================

function calculateHealthScore(state, questions) {
    const today = getToday();
    const weekAgo = getDateDaysAgo(7);
    
    // 1. ACCURACY - Last 7 days
    const recentSessions = state.riwayatSesi.filter(s => s.tanggal >= weekAgo);
    let totalCorrect = 0;
    let totalAttempts = 0;
    recentSessions.forEach(s => {
        totalCorrect += s.jumlahBenar || 0;
        totalAttempts += (s.jumlahBenar || 0) + (s.jumlahSalah || 0);
    });
    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    
    // 2. RETENTION - Items reviewed with correct answers
    const reviewItems = state.progresItem.filter(i => i.jumlahReview > 0);
    let retTotal = 0;
    let retCorrect = 0;
    reviewItems.forEach(i => {
        retTotal += i.jumlahReview;
        retCorrect += i.jumlahBenar;
    });
    const retention = retTotal > 0 ? Math.round((retCorrect / retTotal) * 100) : 0;
    
    // 3. CONSISTENCY - Streak with tolerance
    const streak = state.streak.streakSaatIni || 0;
    const maxStreak = Math.max(streak, state.bestStreak || 0);
    const consistency = Math.min(Math.round((streak / 30) * 100), 100);
    
    // 4. GROWTH - Level progress based on total items learned
    const totalItems = state.progresItem.length;
    const levelMap = { 'A1': 0, 'A2': 25, 'B1': 50, 'B2': 75, 'C1': 100 };
    const currentLevel = state.profilUser.level || 'A1';
    const growth = levelMap[currentLevel] || 0;
    
    // Overall score (weighted average)
    const weights = { accuracy: 0.25, retention: 0.35, consistency: 0.2, growth: 0.2 };
    const totalScore = Math.round(
        (accuracy * weights.accuracy) +
        (retention * weights.retention) +
        (consistency * weights.consistency) +
        (growth * weights.growth)
    );
    
    // Update state
    state.learningHealthScore = {
        tanggal: today,
        akurasi: accuracy,
        retensi: retention,
        konsistensi: consistency,
        progresLevel: growth,
        skorTotal: Math.min(totalScore, 100)
    };
    saveState(state);
    
    return state.learningHealthScore;
}

// ============================================================
// STREAK SYSTEM
// ============================================================

function updateStreak(state) {
    const today = getToday();
    const lastActive = state.streak.tanggalTerakhirAktif;
    
    if (!lastActive) {
        state.streak.streakSaatIni = 1;
        state.streak.tanggalTerakhirAktif = today;
        state.streak.jumlahBekuTersisa = 1;
    } else if (lastActive === today) {
        // Already active today, do nothing
        return state;
    } else {
        const yesterday = getDateDaysAgo(1);
        if (lastActive === yesterday) {
            // Consecutive day
            state.streak.streakSaatIni += 1;
            state.streak.tanggalTerakhirAktif = today;
            state.streak.jumlahBekuTersisa = 1;
        } else {
            // Gap - use freeze if available
            if (state.streak.jumlahBekuTersisa > 0) {
                state.streak.jumlahBekuTersisa -= 1;
                state.streak.tanggalTerakhirAktif = today;
                // Streak continues
            } else {
                // Reset streak
                if (state.streak.streakSaatIni > (state.bestStreak || 0)) {
                    state.bestStreak = state.streak.streakSaatIni;
                }
                state.streak.streakSaatIni = 1;
                state.streak.tanggalTerakhirAktif = today;
                state.streak.jumlahBekuTersisa = 1;
            }
        }
    }
    
    // Update best streak
    if (state.streak.streakSaatIni > (state.bestStreak || 0)) {
        state.bestStreak = state.streak.streakSaatIni;
    }
    
    saveState(state);
    return state;
}

// ============================================================
// QUESTION BANK
// ============================================================

let questionBank = [];

function loadQuestionBank() {
    // In a real implementation, this would load from the JSON file
    // For now, we'll use embedded sample data
    questionBank = getSampleQuestions();
    return questionBank;
}

function getQuestionsBySkill(skill, level = null) {
    let filtered = questionBank.filter(q => q.skill === skill);
    if (level) {
        filtered = filtered.filter(q => q.level === level);
    }
    return shuffleArray(filtered);
}

function getQuestionById(id) {
    return questionBank.find(q => q.id === id);
}

// ============================================================
// SAMPLE QUESTIONS
// ============================================================

function getSampleQuestions() {
    return [
        // Vocabulary
        {
            id: 'voc-0001',
            skill: 'vocabulary',
            level: 'A1',
            type: 'multiple_choice',
            question: 'What is the meaning of "happy"?',
            options: ['Sedih', 'Senang', 'Marah', 'Takut'],
            answer: 'Senang',
            tags: ['adjective', 'feelings']
        },
        {
            id: 'voc-0002',
            skill: 'vocabulary',
            level: 'A1',
            type: 'multiple_choice',
            question: 'What is the meaning of "big"?',
            options: ['Kecil', 'Besar', 'Tinggi', 'Pendek'],
            answer: 'Besar',
            tags: ['adjective', 'size']
        },
        {
            id: 'voc-0003',
            skill: 'vocabulary',
            level: 'A2',
            type: 'multiple_choice',
            question: 'What is the meaning of "exhausted"?',
            options: ['Sangat lelah', 'Sangat senang', 'Sangat marah', 'Sangat cepat'],
            answer: 'Sangat lelah',
            tags: ['adjective', 'feelings']
        },
        {
            id: 'voc-0004',
            skill: 'vocabulary',
            level: 'A2',
            type: 'multiple_choice',
            question: 'What is the meaning of "brave"?',
            options: ['Pengecut', 'Berani', 'Malas', 'Rajin'],
            answer: 'Berani',
            tags: ['adjective', 'character']
        },
        {
            id: 'voc-0005',
            skill: 'vocabulary',
            level: 'B1',
            type: 'multiple_choice',
            question: 'What is the meaning of "fragile"?',
            options: ['Kuat', 'Mudah pecah', 'Berat', 'Ringan'],
            answer: 'Mudah pecah',
            tags: ['adjective', 'quality']
        },
        {
            id: 'voc-0006',
            skill: 'vocabulary',
            level: 'B1',
            type: 'multiple_choice',
            question: 'What is the meaning of "generous"?',
            options: ['Pelit', 'Dermawan', 'Kikir', 'Egois'],
            answer: 'Dermawan',
            tags: ['adjective', 'character']
        },
        {
            id: 'voc-0007',
            skill: 'vocabulary',
            level: 'B1',
            type: 'multiple_choice',
            question: 'What is the meaning of "curious"?',
            options: ['Acuh tak acuh', 'Ingin tahu', 'Takut', 'Marah'],
            answer: 'Ingin tahu',
            tags: ['adjective', 'character']
        },
        {
            id: 'voc-0008',
            skill: 'vocabulary',
            level: 'A2',
            type: 'multiple_choice',
            question: 'What is the meaning of "calm"?',
            options: ['Gelisah', 'Tenang', 'Cemas', 'Marah'],
            answer: 'Tenang',
            tags: ['adjective', 'emotion']
        },
        {
            id: 'voc-0009',
            skill: 'vocabulary',
            level: 'A1',
            type: 'multiple_choice',
            question: 'What is the meaning of "small"?',
            options: ['Besar', 'Kecil', 'Pendek', 'Tinggi'],
            answer: 'Kecil',
            tags: ['adjective', 'size']
        },
        {
            id: 'voc-0010',
            skill: 'vocabulary',
            level: 'A2',
            type: 'multiple_choice',
            question: 'What is the meaning of "patient"?',
            options: ['Sabar', 'Tidak sabar', 'Marah', 'Sedih'],
            answer: 'Sabar',
            tags: ['adjective', 'character']
        },
        
        // Grammar
        {
            id: 'gram-0001',
            skill: 'grammar',
            level: 'A1',
            type: 'fill_blank',
            question: 'She ___ to school every day.',
            answer: 'goes',
            tags: ['present_simple']
        },
        {
            id: 'gram-0002',
            skill: 'grammar',
            level: 'A1',
            type: 'fill_blank',
            question: 'They ___ playing football now.',
            answer: 'are',
            tags: ['present_continuous']
        },
        {
            id: 'gram-0003',
            skill: 'grammar',
            level: 'A2',
            type: 'fill_blank',
            question: 'I ___ (be) born in 1990.',
            answer: 'was',
            tags: ['past_simple']
        },
        {
            id: 'gram-0004',
            skill: 'grammar',
            level: 'A2',
            type: 'fill_blank',
            question: 'She ___ (eat) breakfast already.',
            answer: 'has eaten',
            tags: ['present_perfect']
        },
        {
            id: 'gram-0005',
            skill: 'grammar',
            level: 'B1',
            type: 'fill_blank',
            question: 'If I ___ (be) you, I would study harder.',
            answer: 'were',
            tags: ['conditional']
        },
        {
            id: 'gram-0006',
            skill: 'grammar',
            level: 'B1',
            type: 'fill_blank',
            question: 'The book ___ (write) by J.K. Rowling.',
            answer: 'was written',
            tags: ['passive_voice']
        },
        {
            id: 'gram-0007',
            skill: 'grammar',
            level: 'A2',
            type: 'fill_blank',
            question: 'He ___ (go) to the cinema yesterday.',
            answer: 'went',
            tags: ['past_simple']
        },
        {
            id: 'gram-0008',
            skill: 'grammar',
            level: 'A1',
            type: 'fill_blank',
            question: 'We ___ (be) going to the park.',
            answer: 'are',
            tags: ['present_continuous']
        },
        {
            id: 'gram-0009',
            skill: 'grammar',
            level: 'B1',
            type: 'fill_blank',
            question: 'I have never ___ (see) such a beautiful sunset.',
            answer: 'seen',
            tags: ['present_perfect']
        },
        {
            id: 'gram-0010',
            skill: 'grammar',
            level: 'B1',
            type: 'fill_blank',
            question: 'The house ___ (build) in 1990.',
            answer: 'was built',
            tags: ['passive_voice']
        },
        
        // Listening
        {
            id: 'lis-0001',
            skill: 'listening',
            level: 'A1',
            type: 'multiple_choice',
            audio_text: 'The cat is sleeping on the chair.',
            question: 'Where is the cat sleeping?',
            options: ['On the table', 'On the chair', 'On the floor', 'On the bed'],
            answer: 'On the chair'
        },
        {
            id: 'lis-0002',
            skill: 'listening',
            level: 'A1',
            type: 'multiple_choice',
            audio_text: 'I like to eat apples and bananas.',
            question: 'What fruits does the person like?',
            options: ['Oranges and apples', 'Apples and bananas', 'Bananas and grapes', 'Grapes and oranges'],
            answer: 'Apples and bananas'
        },
        {
            id: 'lis-0003',
            skill: 'listening',
            level: 'A2',
            type: 'multiple_choice',
            audio_text: 'The meeting starts at nine o\'clock.',
            question: 'What time does the meeting start?',
            options: ['8 o\'clock', '9 o\'clock', '10 o\'clock', '11 o\'clock'],
            answer: '9 o\'clock'
        },
        {
            id: 'lis-0004',
            skill: 'listening',
            level: 'A2',
            type: 'multiple_choice',
            audio_text: 'She went to the library to borrow a book.',
            question: 'Why did she go to the library?',
            options: ['To study', 'To borrow a book', 'To meet a friend', 'To return a book'],
            answer: 'To borrow a book'
        },
        {
            id: 'lis-0005',
            skill: 'listening',
            level: 'B1',
            type: 'multiple_choice',
            audio_text: 'Despite the rain, they decided to go for a walk.',
            question: 'What did they decide to do despite the weather?',
            options: ['Stay home', 'Go for a walk', 'Watch a movie', 'Cook dinner'],
            answer: 'Go for a walk'
        },
        
        // Speaking
        {
            id: 'spk-0001',
            skill: 'speaking',
            level: 'A1',
            type: 'shadowing',
            text: 'Could you please repeat that?'
        },
        {
            id: 'spk-0002',
            skill: 'speaking',
            level: 'A1',
            type: 'shadowing',
            text: 'Hello, how are you today?'
        },
        {
            id: 'spk-0003',
            skill: 'speaking',
            level: 'A2',
            type: 'shadowing',
            text: 'I would like to order a coffee, please.'
        },
        {
            id: 'spk-0004',
            skill: 'speaking',
            level: 'A2',
            type: 'shadowing',
            text: 'Can you tell me where the nearest station is?'
        },
        {
            id: 'spk-0005',
            skill: 'speaking',
            level: 'B1',
            type: 'shadowing',
            text: 'I believe that learning a new language opens many doors.'
        }
    ];
}

// ============================================================
// DASHBOARD RENDER FUNCTIONS
// ============================================================

function renderDashboard() {
    const state = getState();
    checkResetEnergy(state);
    
    // Date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    // Streak
    const streakDisplay = document.getElementById('streakDisplay');
    const streak = state.streak.streakSaatIni || 0;
    streakDisplay.textContent = `🔥 ${streak} hari`;
    
    // Energy
    renderEnergy(state);
    
    // Health Score
    const health = calculateHealthScore(state, questionBank);
    renderHealthScore(health);
    
    // Review Queue
    renderReviewQueue(state);
    
    // Session buttons
    updateSessionButtons(state);
}

function renderEnergy(state) {
    const bubblesContainer = document.getElementById('energyBubbles');
    const energyText = document.getElementById('energyText');
    const remaining = state.energiHarian.sisaEnergi;
    const total = 5;
    
    // Clear bubbles
    bubblesContainer.innerHTML = '';
    
    for (let i = 0; i < total; i++) {
        const bubble = document.createElement('span');
        bubble.className = 'energy-bubble';
        if (i < remaining) {
            bubble.classList.add('active');
            bubble.textContent = '⚡';
        } else {
            bubble.classList.add('used');
            bubble.textContent = '○';
        }
        bubblesContainer.appendChild(bubble);
    }
    
    energyText.textContent = `Sisa: ${remaining} dari ${total}`;
}

function renderHealthScore(health) {
    const circle = document.getElementById('healthScoreCircle');
    const number = document.getElementById('healthScoreNumber');
    const score = health.skorTotal || 0;
    
    number.textContent = score;
    
    // Color based on score
    circle.className = 'score-circle';
    if (score >= 70) circle.classList.add('good');
    else if (score >= 40) circle.classList.add('mid');
    else circle.classList.add('bad');
    
    // Update bars
    document.getElementById('accuracyBar').style.width = (health.akurasi || 0) + '%';
    document.getElementById('accuracyText').textContent = (health.akurasi || 0) + '%';
    
    document.getElementById('retentionBar').style.width = (health.retensi || 0) + '%';
    document.getElementById('retentionText').textContent = (health.retensi || 0) + '%';
    
    document.getElementById('consistencyBar').style.width = (health.konsistensi || 0) + '%';
    document.getElementById('consistencyText').textContent = (health.konsistensi || 0) + '%';
    
    document.getElementById('growthBar').style.width = (health.progresLevel || 0) + '%';
    document.getElementById('growthText').textContent = (health.progresLevel || 0) + '%';
}

function renderReviewQueue(state) {
    const container = document.getElementById('reviewQueue');
    const dueItems = getDueItems(state, questionBank);
    
    if (dueItems.length === 0) {
        container.innerHTML = '<p class="empty-message">✨ Tidak ada item yang perlu direview hari ini</p>';
        return;
    }
    
    container.innerHTML = '';
    dueItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'review-queue-item';
        const level = item.question ? item.question.level : 'A1';
        const text = item.question ? item.question.question : item.idSoal;
        div.innerHTML = `
            <span>${text}</span>
            <span class="level-tag">${level}</span>
        `;
        container.appendChild(div);
    });
}

function updateSessionButtons(state) {
    const remaining = state.energiHarian.sisaEnergi;
    const buttons = document.querySelectorAll('.session-btn');
    
    buttons.forEach(btn => {
        const cost = parseInt(btn.dataset.energy) || 1;
        if (remaining < cost) {
            btn.disabled = true;
            btn.title = 'Energi tidak cukup!';
        } else {
            btn.disabled = false;
            btn.title = '';
        }
    });
}

// ============================================================
// SESSION HANDLING
// ============================================================

let currentSession = {
    skill: '',
    questions: [],
    currentIndex: 0,
    correct: 0,
    wrong: 0,
    type: 'materiBaru' // or 'review'
};

function startSession(skill, type = 'materiBaru') {
    const state = getState();
    
    // Check energy for new material session
    if (type === 'materiBaru') {
        const costMap = {
            'vocab-grammar': 2,
            'listening': 1,
            'speaking': 1,
            'free': 1
        };
        const cost = costMap[skill] || 1;
        
        if (state.energiHarian.sisaEnergi < cost) {
            alert('Energi tidak cukup! Lakukan sesi review atau tunggu besok.');
            return;
        }
        
        // Use energy
        const result = useEnergy(state, skill, cost);
        if (!result.success) {
            alert(result.message);
            return;
        }
    }
    
    // Get questions
    let questions = [];
    if (type === 'review') {
        const dueItems = getDueItems(state, questionBank);
        questions = dueItems.map(item => ({
            ...item.question,
            _progressItem: item
        }));
    } else {
        questions = getQuestionsBySkill(skill);
        // Limit to 10 questions per session
        questions = questions.slice(0, 10);
    }
    
    if (questions.length === 0) {
        alert('Tidak ada soal yang tersedia untuk skill ini.');
        return;
    }
    
    // Initialize session
    currentSession = {
        skill: skill,
        questions: questions,
        currentIndex: 0,
        correct: 0,
        wrong: 0,
        type: type
    };
    
    // Redirect to appropriate page
    let page = '';
    switch(skill) {
        case 'vocab-grammar':
            page = 'vocab-grammar.html';
            break;
        case 'listening':
            page = 'listening.html';
            break;
        case 'speaking':
            page = 'speaking.html';
            break;
        default:
            page = 'vocab-grammar.html';
    }
    
    // Save session to localStorage for the page to load
    localStorage.setItem('currentSession', JSON.stringify(currentSession));
    window.location.href = page;
}

function loadSessionPage() {
    const saved = localStorage.getItem('currentSession');
    if (!saved) {
        window.location.href = 'index.html';
        return;
    }
    
    currentSession = JSON.parse(saved);
    renderQuestion();
}

function renderQuestion() {
    const qs = currentSession.questions;
    const idx = currentSession.currentIndex;
    
    if (idx >= qs.length) {
        showSessionResult();
        return;
    }
    
    const q = qs[idx];
    
    // Update info
    document.getElementById('currentQuestionNum').textContent = idx + 1;
    document.getElementById('totalQuestions').textContent = qs.length;
    document.getElementById('questionLevel').textContent = q.level || 'A1';
    
    // Render question based on type
    const container = document.getElementById('questionContainer');
    
    if (q.type === 'multiple_choice') {
        renderMultipleChoice(container, q);
    } else if (q.type === 'fill_blank') {
        renderFillBlank(container, q);
    } else if (q.type === 'shadowing') {
        renderShadowing(container, q);
    } else {
        container.innerHTML = `<p>Unknown question type: ${q.type}</p>`;
    }
    
    // Update progress
    document.getElementById('progressBar').style.width = ((idx / qs.length) * 100) + '%';
    
    // Hide result
    document.getElementById('sessionResult').style.display = 'none';
    
    // Show submit button, hide next
    document.getElementById('submitBtn').style.display = 'inline-block';
    document.getElementById('submitBtn').disabled = true;
    document.getElementById('nextBtn').style.display = 'none';
}

function renderMultipleChoice(container, q) {
    const optionsHtml = q.options.map((opt, i) => `
        <div class="option-item" data-index="${i}" onclick="selectOption(this, '${q.id}')">
            ${opt}
        </div>
    `).join('');
    
    container.innerHTML = `
        <div class="question-text">${q.question}</div>
        <div class="options-grid">${optionsHtml}</div>
        <input type="hidden" id="selectedOption" value="">
        <input type="hidden" id="correctAnswer" value="${q.answer}">
    `;
}

function renderFillBlank(container, q) {
    container.innerHTML = `
        <div class="question-text">${q.question}</div>
        <input type="text" id="fillInput" class="fill-input" placeholder="Ketik jawaban..." 
               oninput="checkFillInput()">
        <input type="hidden" id="correctAnswer" value="${q.answer}">
    `;
    document.getElementById('submitBtn').disabled = false;
}

function renderShadowing(container, q) {
    container.innerHTML = `
        <div class="question-text">📢 Baca kalimat berikut dengan lantang:</div>
        <div style="font-size:1.3rem; padding:20px; background:#f8fafc; border-radius:12px; text-align:center; margin:12px 0;">
            "${q.text}"
        </div>
        <p style="color:#94a3b8; font-size:0.85rem;">Tekan tombol rekam, baca kalimat, lalu tekan stop</p>
        <input type="hidden" id="shadowingText" value="${q.text}">
    `;
    document.getElementById('submitBtn').style.display = 'inline-block';
    document.getElementById('submitBtn').disabled = false;
}

function selectOption(el, questionId) {
    const container = document.getElementById('questionContainer');
    const options = container.querySelectorAll('.option-item');
    options.forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('selectedOption').value = el.textContent;
    document.getElementById('submitBtn').disabled = false;
}

function checkFillInput() {
    const input = document.getElementById('fillInput');
    if (input && input.value.trim().length > 0) {
        document.getElementById('submitBtn').disabled = false;
    } else {
        document.getElementById('submitBtn').disabled = true;
    }
}

function submitAnswer() {
    const q = currentSession.questions[currentSession.currentIndex];
    const container = document.getElementById('questionContainer');
    const submitBtn = document.getElementById('submitBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    let userAnswer = '';
    let isCorrect = false;
    
    if (q.type === 'multiple_choice') {
        userAnswer = document.getElementById('selectedOption')?.value || '';
        isCorrect = userAnswer === q.answer;
        
        // Highlight correct/wrong
        const options = container.querySelectorAll('.option-item');
        options.forEach(opt => {
            opt.classList.add('disabled');
            if (opt.textContent === q.answer) {
                opt.classList.add('correct');
            }
            if (opt.classList.contains('selected') && !isCorrect) {
                opt.classList.add('wrong');
            }
        });
        
    } else if (q.type === 'fill_blank') {
        const input = document.getElementById('fillInput');
        userAnswer = input.value.trim().to
