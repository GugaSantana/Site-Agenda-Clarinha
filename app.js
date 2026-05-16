// ═══════════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DO FIREBASE
//  ──────────────────────────────────────────────────────────────────
//  1. Acesse https://console.firebase.google.com
//  2. Crie um projeto (é gratuito, não precisa de cartão)
//  3. Crie um banco Firestore → em modo "teste" por agora
//  4. Vá em ⚙️ → Configurações do projeto → Seus apps → Web (</> )
//  5. Copie o objeto firebaseConfig e cole aqui abaixo
// ═══════════════════════════════════════════════════════════════════
import { initializeApp }               from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection,
         addDoc, onSnapshot, doc,
         updateDoc, deleteDoc, query,
         orderBy, serverTimestamp }     from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDJ1kJ84FsLumUtX18gz_SaUtF5Uy8x4pU",
  authDomain: "agenda-ana-clara.firebaseapp.com",
  projectId: "agenda-ana-clara",
  storageBucket: "agenda-ana-clara.firebasestorage.app",
  messagingSenderId: "432206466810",
  appId: "1:432206466810:web:0975634219b1ebd659c343"
};

// ─── Detectar se ainda não foi configurado ──────────────────────────
if (Object.values(firebaseConfig).includes("COLE_AQUI")) {
  document.getElementById('loadingOverlay').classList.add('hidden');
  document.getElementById('setupOverlay').removeAttribute('hidden');
  throw new Error("Firebase não configurado. Siga as instruções no ecrã.");
}

// ─── Inicializar Firebase ───────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const tasksRef = collection(db, 'tasks');
const plansRef = collection(db, 'plans');

// ═══════════════════════════════════════════════════════════════════
//  Utilitários de data
// ═══════════════════════════════════════════════════════════════════
function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDatePT(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}

const TODAY = getTodayISO();

// ─── Preencher header ────────────────────────────────────────────────
document.getElementById('headerDate').textContent = formatDatePT(TODAY);
document.getElementById('taskDate').value = TODAY;

// ═══════════════════════════════════════════════════════════════════
//  Criar elemento de tarefa
// ═══════════════════════════════════════════════════════════════════
function createTaskEl(id, data) {
  const li = document.createElement('li');
  const isOverdue = data.date < TODAY && !data.completed;
  li.className = [
    'task-item',
    data.completed ? 'is-completed' : '',
    isOverdue       ? 'is-overdue'   : ''
  ].filter(Boolean).join(' ');
  li.dataset.id = id;

  // Checkbox
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'task-check';
  check.checked = data.completed;
  check.setAttribute('aria-label', `Marcar "${data.text}" como concluída`);
  check.addEventListener('change', () => toggleTask(id, check.checked, li));

  // Content
  const content = document.createElement('div');
  content.className = 'task-content';

  const textEl = document.createElement('span');
  textEl.className = 'task-text';
  textEl.textContent = data.text;
  content.appendChild(textEl);

  // Meta (date + overdue tag)
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const dateEl = document.createElement('span');
  dateEl.className = 'task-date';
  dateEl.textContent = formatDatePT(data.date);
  meta.appendChild(dateEl);

  if (isOverdue) {
    const tag = document.createElement('span');
    tag.className = 'tag-overdue';
    tag.textContent = 'atrasada';
    meta.appendChild(tag);
  }

  // Only show date meta for non-today tasks or completed tasks
  if (data.date !== TODAY || data.completed) {
    content.appendChild(meta);
  }

  // Delete button
  const del = document.createElement('button');
  del.className = 'task-delete';
  del.textContent = '✕';
  del.title = 'Remover tarefa';
  del.setAttribute('aria-label', `Remover tarefa "${data.text}"`);
  del.addEventListener('click', () => deleteTask(id));

  li.append(check, content, del);
  return li;
}

// ═══════════════════════════════════════════════════════════════════
//  Renderizar todas as tarefas
// ═══════════════════════════════════════════════════════════════════
function setList(ulId, tasks, emptyMsg) {
  const ul = document.getElementById(ulId);
  ul.innerHTML = '';
  if (tasks.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = emptyMsg;
    ul.appendChild(li);
    return;
  }
  tasks.forEach(t => ul.appendChild(createTaskEl(t.id, t.data)));
}

function renderTasks(tasks) {
  // Sort by date ascending
  const sorted = [...tasks].sort((a, b) => (a.data.date < b.data.date ? -1 : a.data.date > b.data.date ? 1 : 0));

  const todayPending  = sorted.filter(t => t.data.date === TODAY && !t.data.completed);
  const otherPending  = sorted.filter(t => t.data.date !== TODAY && !t.data.completed);
  const completed     = sorted.filter(t => t.data.completed);

  // Today count badge
  document.getElementById('todayCount').textContent = todayPending.length;

  setList('todayList',     todayPending, 'Nenhuma tarefa para hoje 🌸');
  setList('pendingList',   otherPending, 'Nenhuma outra tarefa pendente ✨');
  setList('completedList', completed,    'Nenhuma tarefa concluída ainda');

  // Hide empty sections for cleanliness
  document.getElementById('pendingSection').style.display   = (otherPending.length === 0 && completed.length > 0) ? 'none' : '';
  document.getElementById('completedSection').style.display = completed.length === 0 ? 'none' : '';
}

// ═══════════════════════════════════════════════════════════════════
//  Firebase: escutar em tempo real
// ═══════════════════════════════════════════════════════════════════
const q = query(tasksRef, orderBy('createdAt', 'asc'));

onSnapshot(q, (snapshot) => {
  const tasks = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
  renderTasks(tasks);
  // Hide loading after first snapshot
  document.getElementById('loadingOverlay').classList.add('hidden');
}, (err) => {
  console.error("Erro ao carregar tarefas:", err);
  document.getElementById('loadingOverlay').classList.add('hidden');
});

// ═══════════════════════════════════════════════════════════════════
//  Firebase: adicionar tarefa
// ═══════════════════════════════════════════════════════════════════
document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const textInput = document.getElementById('taskText');
  const dateInput = document.getElementById('taskDate');
  const btn       = e.target.querySelector('button[type="submit"]');

  const text = textInput.value.trim();
  const date = dateInput.value;
  if (!text || !date) return;

  btn.disabled = true;
  btn.textContent = '...';

  try {
    await addDoc(tasksRef, {
      text,
      date,
      completed: false,
      createdAt: serverTimestamp()
    });
    textInput.value = '';
    dateInput.value = TODAY;
    textInput.focus();
  } catch (err) {
    console.error("Erro ao adicionar tarefa:", err);
    alert("Não foi possível salvar a tarefa. Verifique sua conexão.");
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar';
  }
});

// ═══════════════════════════════════════════════════════════════════
//  Firebase: alternar conclusão
// ═══════════════════════════════════════════════════════════════════
async function toggleTask(id, completed, liEl) {
  try {
    await updateDoc(doc(db, 'tasks', id), { completed });
    if (completed) launchConfetti(liEl);
  } catch (err) {
    console.error("Erro ao atualizar tarefa:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Firebase: deletar tarefa
// ═══════════════════════════════════════════════════════════════════
async function deleteTask(id) {
  try {
    await deleteDoc(doc(db, 'tasks', id));
  } catch (err) {
    console.error("Erro ao remover tarefa:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Confetti 🎉
// ═══════════════════════════════════════════════════════════════════
function launchConfetti(liEl) {
  const colors = ['#BF9470', '#E8D5C0', '#EDD9C5', '#8A6642', '#FFF8F0', '#F5EAE0'];

  // Position confetti near the checked item
  let originX = 0.5;
  let originY = 0.6;
  if (liEl) {
    const rect = liEl.getBoundingClientRect();
    originX = (rect.left + rect.width / 2) / window.innerWidth;
    originY = (rect.top + rect.height / 2) / window.innerHeight;
  }

  window.confetti({
    particleCount: 90,
    spread: 75,
    origin: { x: originX, y: Math.min(originY, 0.85) },
    colors,
    scalar: 1.05,
    ticks: 220
  });
}

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — elemento
// ═══════════════════════════════════════════════════════════════════
function createPlanEl(id, data) {
  const li = document.createElement('li');
  li.className = ['plan-item', data.done ? 'is-done' : ''].filter(Boolean).join(' ');
  li.dataset.id = id;

  // Heart checkbox
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'plan-check';
  check.checked = data.done;
  check.setAttribute('aria-label', `Marcar "${data.text}" como feito`);
  check.addEventListener('change', () => {
    if (check.checked) {
      showDatePicker(id, li, check, content);
    } else {
      // Desmarcar: remover picker se aberto e limpar data
      const picker = li.querySelector('.plan-date-picker');
      if (picker) picker.remove();
      togglePlan(id, false, null);
    }
  });

  // Text + data de conclusão
  const content = document.createElement('div');
  content.className = 'plan-content';

  const textEl = document.createElement('span');
  textEl.className = 'plan-text';
  textEl.textContent = data.text;
  content.appendChild(textEl);

  if (data.done && data.doneAt) {
    const doneDate = data.doneAt.toDate ? data.doneAt.toDate() : new Date(data.doneAt);
    const doneDateEl = document.createElement('span');
    doneDateEl.className = 'plan-done-date';
    doneDateEl.textContent = '✓ ' + doneDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    content.appendChild(doneDateEl);
  }

  // Delete
  const del = document.createElement('button');
  del.className = 'plan-delete';
  del.textContent = '✕';
  del.title = 'Remover plano';
  del.setAttribute('aria-label', `Remover plano "${data.text}"`);
  del.addEventListener('click', () => deletePlan(id));

  li.append(check, content, del);
  return li;
}

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — renderizar
// ═══════════════════════════════════════════════════════════════════
function renderPlans(plans) {
  const ul = document.getElementById('plansList');
  ul.innerHTML = '';

  // Pendentes primeiro, feitos depois
  const sorted = [
    ...plans.filter(p => !p.data.done),
    ...plans.filter(p =>  p.data.done)
  ];

  document.getElementById('plansCount').textContent = plans.filter(p => !p.data.done).length;

  if (sorted.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Nenhum plano ainda ✨';
    ul.appendChild(li);
    return;
  }

  sorted.forEach(p => ul.appendChild(createPlanEl(p.id, p.data)));
}

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — escutar em tempo real
// ═══════════════════════════════════════════════════════════════════
onSnapshot(query(plansRef, orderBy('createdAt', 'asc')), (snapshot) => {
  const plans = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
  renderPlans(plans);
});

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — adicionar
// ═══════════════════════════════════════════════════════════════════
document.getElementById('planForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const textInput = document.getElementById('planText');
  const btn       = e.target.querySelector('button[type="submit"]');
  const text      = textInput.value.trim();
  if (!text) return;

  btn.disabled = true;
  btn.textContent = '...';

  try {
    await addDoc(plansRef, {
      text,
      done: false,
      createdAt: serverTimestamp()
    });
    textInput.value = '';
    textInput.focus();
  } catch (err) {
    console.error("Erro ao adicionar plano:", err);
    alert("Não foi possível salvar o plano. Verifique sua conexão.");
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar';
  }
});

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — picker de data inline
// ═══════════════════════════════════════════════════════════════════
function showDatePicker(id, li, check, content) {
  // Remover picker anterior se houver
  const existing = li.querySelector('.plan-date-picker');
  if (existing) existing.remove();

  const row = document.createElement('div');
  row.className = 'plan-date-picker';

  const label = document.createElement('span');
  label.className = 'plan-date-picker-label';
  label.textContent = 'Quando fizemos isso?';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'plan-date-picker-input';
  dateInput.value = TODAY;
  dateInput.max = TODAY;

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'plan-date-picker-confirm';
  confirmBtn.textContent = 'Confirmar';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'plan-date-picker-cancel';
  cancelBtn.textContent = 'Cancelar';

  confirmBtn.addEventListener('click', async () => {
    const chosenDate = dateInput.value;
    if (!chosenDate) return;

    // Montar timestamp a partir da data escolhida
    const [y, m, d] = chosenDate.split('-').map(Number);
    const doneAt = new Date(y, m - 1, d);

    row.remove();
    await togglePlan(id, true, li, doneAt);
  });

  cancelBtn.addEventListener('click', () => {
    check.checked = false;
    row.remove();
  });

  row.append(label, dateInput, confirmBtn, cancelBtn);

  // Inserir o picker dentro do item, após o conteúdo
  li.appendChild(row);
  dateInput.focus();
}

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — alternar feito
// ═══════════════════════════════════════════════════════════════════
async function togglePlan(id, done, liEl, doneAtDate = null) {
  try {
    const update = { done };
    if (done && doneAtDate) {
      update.doneAt = doneAtDate;
    } else if (!done) {
      update.doneAt = null;
    }
    await updateDoc(doc(db, 'plans', id), update);
    if (done) launchConfetti(liEl);
  } catch (err) {
    console.error("Erro ao atualizar plano:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Nossos Planos — deletar
// ═══════════════════════════════════════════════════════════════════
async function deletePlan(id) {
  try {
    await deleteDoc(doc(db, 'plans', id));
  } catch (err) {
    console.error("Erro ao remover plano:", err);
  }
}
