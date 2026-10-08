const STORAGE_KEY = "ps-hub-progress";

const DEFAULT_PROGRESS = {
    version: 1,
    tasks: {},
    checklist: {},
    mastery: {},
    notes: {},
    promptHistory: [],
    settings: {
        theme: "light",
        lastTopicId: null
    }
};

function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(DEFAULT_PROGRESS);
        const data = JSON.parse(raw);
        return { ...structuredClone(DEFAULT_PROGRESS), ...data };
    } catch (e) {
        console.error("加载进度失败", e);
        return structuredClone(DEFAULT_PROGRESS);
    }
}

function saveProgress() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(PROGRESS));
    } catch (e) {
        console.error("保存进度失败", e);
    }
}

let PROGRESS = loadProgress();

function exportProgress() {
    const blob = new Blob([JSON.stringify(PROGRESS, null, 2)], {
        type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ps-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importProgress(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                PROGRESS = { ...structuredClone(DEFAULT_PROGRESS), ...data };
                saveProgress();
                resolve(PROGRESS);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
}
