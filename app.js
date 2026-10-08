let currentTopicId = null;
let currentPrompts = [];

document.addEventListener("DOMContentLoaded", init);

function init() {
    applyTheme();
    renderStageTabs();
    renderTree();
    bindEvents();

    if (PROGRESS.settings.lastTopicId) {
        const found = findTopic(PROGRESS.settings.lastTopicId);
        if (found) selectTopic(PROGRESS.settings.lastTopicId);
    }
    updateTopProgress();
}

function findTopic(id) {
    for (const stage of PS_CURRICULUM) {
        for (const mod of stage.modules) {
            for (const topic of mod.topics) {
                if (topic.id === id) return { stage, mod, topic };
            }
        }
    }
    return null;
}

function renderStageTabs() {
    const el = document.getElementById("stageTabs");
    el.innerHTML = PS_CURRICULUM.map(
        (s) => `<span class="stage-chip">${s.title}</span>`
    ).join("");
}

function renderTree(filter = "") {
    const el = document.getElementById("topicTree");
    const kw = filter.trim().toLowerCase();
    let html = "";

    PS_CURRICULUM.forEach((stage) => {
        let stageHtml = "";
        let stageHas = false;

        stage.modules.forEach((mod) => {
            let modHtml = "";
            mod.topics.forEach((topic) => {
                if (
                    kw &&
                    !topic.title.toLowerCase().includes(kw) &&
                    !topic.goal.toLowerCase().includes(kw)
                )
                    return;
                stageHas = true;
                const done = isTopicDone(topic.id);
                const active = topic.id === currentTopicId ? " active" : "";
                modHtml += `<a class="topic-item${done ? " done" : ""}${active}"
          data-topic="${topic.id}">${topic.title}</a>`;
            });
            if (modHtml) {
                modHtml = `<div class="module-title">${mod.title}</div>${modHtml}`;
                stageHtml += modHtml;
            }
        });

        if (stageHas) {
            html += `<div class="stage-title">${stage.title}</div>${stageHtml}`;
        }
    });

    el.innerHTML = html || `<p class="hint">没有匹配的知识点</p>`;
}

function isTopicDone(topicId) {
    const found = findTopic(topicId);
    if (!found) return false;
    const { topic } = found;
    const tasksDone = (topic.tasks || []).every((t) => PROGRESS.tasks[t.id]);
    const checksDone = (topic.checklist || []).every(
        (_, i) => PROGRESS.checklist[`${topicId}-check-${i}`]
    );
    return tasksDone && checksDone;
}

function selectTopic(id) {
    const found = findTopic(id);
    if (!found) return;
    currentTopicId = id;
    PROGRESS.settings.lastTopicId = id;
    saveProgress();

    renderTree(document.getElementById("searchInput").value);
    renderContent(found);
    renderAIPanel(found);
}

function renderContent({ stage, mod, topic }) {
    const el = document.getElementById("content");
    const mastery = PROGRESS.mastery[topic.id] || "未开始";
    const note = PROGRESS.notes[topic.id] || "";

    el.innerHTML = `
    <div class="content-header">
      <div class="breadcrumb">${stage.title} / ${mod.title}</div>
      <h1>${topic.title}</h1>
      <p class="goal">${topic.goal}</p>
      <div class="mastery-row">
        <label>掌握度：</label>
        <select data-mastery>
          ${["未开始", "学习中", "已练习", "待复习", "已掌握"]
            .map((m) => `<option${m === mastery ? " selected" : ""}>${m}</option>`)
            .join("")}
        </select>
      </div>
    </div>

    <section class="block">
      <h2>核心概念</h2>
      <ul>${topic.concepts.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    </section>

    <section class="block">
      <h2>操作路径</h2>
      <ol>${topic.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>
    </section>

    <section class="block">
      <h2>练习任务</h2>
      <ul class="task-list">
        ${topic.tasks.map((t) => renderTask(t, topic.id)).join("")}
      </ul>
    </section>

    <section class="block">
      <h2>自检清单</h2>
      <ul class="check-list">
        ${topic.checklist
            .map((c, i) => {
                const key = `${topic.id}-check-${i}`;
                return `
            <li>
              <label>
                <input type="checkbox" data-check="${key}"
                  ${PROGRESS.checklist[key] ? "checked" : ""}>
                <span>${escapeHtml(c)}</span>
              </label>
            </li>`;
            })
            .join("")}
      </ul>
    </section>

    <section class="block">
      <h2>常见坑</h2>
      <ul class="pitfall">${topic.pitfalls.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
    </section>

    <section class="block">
      <h2>产出物</h2>
      <p class="output">${escapeHtml(topic.output)}</p>
    </section>

    <section class="block">
      <h2>我的笔记</h2>
      <textarea data-note rows="5" placeholder="记录你的理解、问题、复盘...">${escapeHtml(note)}</textarea>
    </section>
  `;

    el.scrollTop = 0;
    loadAllStepShots(topic);
}

function renderTask(task, topicId) {
    const checked = PROGRESS.tasks[task.id] ? "checked" : "";
    const hasSteps = Array.isArray(task.steps) && task.steps.length > 0;
    return `
    <li class="task-item" data-task-item="${task.id}">
      <div class="task-head">
        <label class="task-check">
          <input type="checkbox" data-task="${task.id}" ${checked}>
          <span class="task-title">${escapeHtml(task.text)}</span>
        </label>
        ${hasSteps ? `<button class="btn-toggle" data-toggle="${task.id}" type="button">展开步骤 ▾</button>` : ""}
      </div>
      <div class="task-body" data-body="${task.id}" hidden>
        ${hasSteps
            ? `<ol class="step-list">
              ${task.steps.map((s, i) => renderStep(s, task.id, topicId, i)).join("")}
            </ol>`
            : ""}
      </div>
    </li>
  `;
}

function renderStep(step, taskId, topicId, index) {
    const text = typeof step === "string" ? step : step.text;
    return `
    <li class="step-item">
      <div class="step-text">
        <span class="step-num">${index + 1}</span>
        <span>${escapeHtml(text)}</span>
      </div>
      <div class="step-shot"
           data-step-shot
           data-task="${taskId}"
           data-topic="${topicId}"
           data-step-index="${index}"
           title="点一下激活，再按 Ctrl+V 粘贴截图；也可拖拽图片进来">
        <div class="step-shot-inner">
          <div class="step-shot-empty">点此激活</div>
        </div>
      </div>
    </li>
  `;
}

async function loadAllStepShots(topic) {
    for (const task of topic.tasks) {
        if (!Array.isArray(task.steps)) continue;
        for (let i = 0; i < task.steps.length; i++) {
            await loadStepShot(task.id, i, topic.id);
        }
    }
}

async function loadStepShot(taskId, stepIndex, topicId) {
    const slot = document.querySelector(
        `[data-step-shot][data-task="${taskId}"][data-step-index="${stepIndex}"]`
    );
    if (!slot) return;
    const inner = slot.querySelector(".step-shot-inner");
    const rec = await getStepShot(taskId, stepIndex);

    if (rec) {
        const url = URL.createObjectURL(rec.blob);
        inner.innerHTML = `
      <img class="step-shot-img" src="${url}" alt="步骤截图"
        data-view-src="${url}">
      <button class="step-shot-del" type="button"
        data-del-step data-task="${taskId}"
        data-step-index="${stepIndex}" data-topic="${topicId}"
        title="删除">×</button>
    `;
        slot.classList.add("has-shot");
    } else {
        inner.innerHTML = `
      <div class="step-shot-empty">点此激活，Ctrl+V 粘贴</div>
    `;
        slot.classList.remove("has-shot");
    }
}

function renderAIPanel({ topic }) {
    currentPrompts = PS_PROMPTS.map((p) => ({
        ...p,
        text: p.build({ ...topic, notes: PROGRESS.notes[topic.id] || "" })
    }));

    const el = document.getElementById("aiPanel");
    el.innerHTML = currentPrompts
        .map(
            (p, i) => `
    <div class="prompt-card">
      <div class="prompt-head">
        <span>${p.name}</span>
        <button class="btn small" data-copy-index="${i}">复制</button>
      </div>
      <pre class="prompt-text">${escapeHtml(p.text)}</pre>
    </div>`
        )
        .join("");
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function updateTopProgress() {
    let total = 0;
    let done = 0;
    PS_CURRICULUM.forEach((stage) => {
        stage.modules.forEach((mod) => {
            mod.topics.forEach((topic) => {
                total++;
                if (isTopicDone(topic.id)) done++;
            });
        });
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("topProgress").style.width = pct + "%";
    document.getElementById("topProgressText").textContent = `${done}/${total} · ${pct}%`;
}

function applyTheme() {
    document.documentElement.dataset.theme = PROGRESS.settings.theme || "light";
    document.getElementById("btnTheme").textContent =
        PROGRESS.settings.theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
    PROGRESS.settings.theme =
        PROGRESS.settings.theme === "dark" ? "light" : "dark";
    saveProgress();
    applyTheme();
}

function bindEvents() {
    document
        .getElementById("searchInput")
        .addEventListener("input", (e) => renderTree(e.target.value));

    document.getElementById("topicTree").addEventListener("click", (e) => {
        const item = e.target.closest("[data-topic]");
        if (item) selectTopic(item.dataset.topic);
    });

    document.getElementById("btnExport").addEventListener("click", exportProgress);

    document.getElementById("btnImport").addEventListener("click", () => {
        document.getElementById("fileImport").click();
    });

    document.getElementById("fileImport").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            await importProgress(file);
            renderTree();
            if (currentTopicId) selectTopic(currentTopicId);
            updateTopProgress();
            alert("导入成功");
        } catch (err) {
            alert("导入失败：" + err.message);
        }
        e.target.value = "";
    });

    document.getElementById("btnTheme").addEventListener("click", toggleTheme);

    document.getElementById("content").addEventListener("change", (e) => {
        const t = e.target;
        if (t.matches("[data-task]")) {
            PROGRESS.tasks[t.dataset.task] = t.checked;
            saveProgress();
            renderTree(document.getElementById("searchInput").value);
            updateTopProgress();
        }
        if (t.matches("[data-check]")) {
            PROGRESS.checklist[t.dataset.check] = t.checked;
            saveProgress();
            renderTree(document.getElementById("searchInput").value);
            updateTopProgress();
        }
        if (t.matches("[data-mastery]")) {
            PROGRESS.mastery[currentTopicId] = t.value;
            saveProgress();
        }
    });

    document.getElementById("content").addEventListener("input", (e) => {
        if (e.target.matches("[data-note]")) {
            PROGRESS.notes[currentTopicId] = e.target.value;
            saveProgress();
        }
    });

    document.getElementById("content").addEventListener("click", async (e) => {
        const toggle = e.target.closest("[data-toggle]");
        if (toggle) {
            const id = toggle.dataset.toggle;
            const body = document.querySelector(`[data-body="${id}"]`);
            const hidden = body.hasAttribute("hidden");
            if (hidden) {
                body.removeAttribute("hidden");
                toggle.textContent = "收起步骤 ▴";
            } else {
                body.setAttribute("hidden", "");
                toggle.textContent = "展开步骤 ▾";
            }
            return;
        }

        const del = e.target.closest("[data-del-step]");
        if (del) {
            if (!confirm("删除这张截图？")) return;
            await deleteStepShot(del.dataset.task, Number(del.dataset.stepIndex));
            await loadStepShot(
                del.dataset.task,
                Number(del.dataset.stepIndex),
                del.dataset.topic
            );
            return;
        }

        const img = e.target.closest("[data-view-src]");
        if (img) {
            const lb = document.getElementById("lightbox");
            document.getElementById("lightboxImg").src = img.dataset.viewSrc;
            lb.hidden = false;
            return;
        }

        const slot = e.target.closest("[data-step-shot]");
        if (slot) {
            document
                .querySelectorAll(".step-shot.active")
                .forEach((el) => el.classList.remove("active"));
            slot.classList.add("active");
            const item = slot.closest(".task-item");
            if (item) {
                const body = item.querySelector(".task-body");
                if (body && body.hasAttribute("hidden")) {
                    body.removeAttribute("hidden");
                    const t = item.querySelector("[data-toggle]");
                    if (t) t.textContent = "收起步骤 ▴";
                }
            }
        }
    });

    document.getElementById("aiPanel").addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-copy-index]");
        if (!btn) return;
        const idx = Number(btn.dataset.copyIndex);
        const text = currentPrompts[idx]?.text;
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
        } catch {
            fallbackCopy(text);
        }

        btn.textContent = "已复制 ✓";
        setTimeout(() => (btn.textContent = "复制"), 1500);

        PROGRESS.promptHistory.push({
            topicId: currentTopicId,
            promptId: currentPrompts[idx].id,
            time: Date.now()
        });
        saveProgress();
    });

    document.getElementById("lightbox").addEventListener("click", () => {
        document.getElementById("lightbox").hidden = true;
    });

    document.getElementById("content").addEventListener("dragover", (e) => {
        const slot = e.target.closest("[data-step-shot]");
        if (slot) {
            e.preventDefault();
            slot.classList.add("drag-over");
        }
    });

    document.getElementById("content").addEventListener("dragleave", (e) => {
        const slot = e.target.closest("[data-step-shot]");
        if (slot) slot.classList.remove("drag-over");
    });

    document.getElementById("content").addEventListener("drop", async (e) => {
        const slot = e.target.closest("[data-step-shot]");
        if (!slot) return;
        e.preventDefault();
        slot.classList.remove("drag-over");

        const files = Array.from(e.dataTransfer.files || []).filter((f) =>
            f.type.startsWith("image/")
        );
        if (!files.length) return;

        const taskId = slot.dataset.task;
        const topicId = slot.dataset.topic;
        const stepIndex = Number(slot.dataset.stepIndex);

        await saveStepShot(files[0], taskId, stepIndex, topicId);
        await loadStepShot(taskId, stepIndex, topicId);
    });

    document.addEventListener("paste", async (e) => {
        const slot = document.querySelector(".step-shot.active");
        if (!slot) return;
        const items = Array.from(e.clipboardData?.items || []);
        const files = items
            .filter((it) => it.type.startsWith("image/"))
            .map((it) => it.getAsFile())
            .filter(Boolean);
        if (!files.length) return;
        e.preventDefault();

        const taskId = slot.dataset.task;
        const topicId = slot.dataset.topic;
        const stepIndex = Number(slot.dataset.stepIndex);

        await saveStepShot(files[0], taskId, stepIndex, topicId);
        await loadStepShot(taskId, stepIndex, topicId);
        slot.classList.remove("active");
    });
}

function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
}
