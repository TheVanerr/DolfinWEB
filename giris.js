// --- SUPABASE BAĞLANTISI ---
const SUPABASE_URL = 'https://unttjuqydgngfqxxhqps.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BORGWK_HJP9KolhGrLnMWw_FkR0Oj3k';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allData = { machines: [], documents: [], machine_docs: [] };
let currentSerial = '';
let currentModel = '';
let deleteTarget = null;
let assignTargetMachine = null;
let currentAdminTab = 'dokuman';
let selectedFile = null;

// Dokuman tipi → kod kısaltması
const docTypeCodeMap = {
  'Kullanım Kılavuzu': 'KK',
  'Elektrik Şeması': 'ES',
  'P&ID Şeması': 'PD',
  'Risk Analizi': 'RA',
  'CE Belgesi': 'CE',
  'Garanti Belgesi': 'GB'
};

// --- VERİ YÜKLEME ---
async function loadAllData() {
  const [machinesRes, documentsRes, machineDocsRes] = await Promise.all([
    supabase.from('machines').select('*').order('created_at', { ascending: false }),
    supabase.from('documents').select('*').order('created_at', { ascending: false }),
    supabase.from('machine_documents').select('*')
  ]);
  
  if (machinesRes.error) console.error('Machines error:', machinesRes.error);
  if (documentsRes.error) console.error('Documents error:', documentsRes.error);
  if (machineDocsRes.error) console.error('Machine_Docs error:', machineDocsRes.error);
  
  allData.machines = machinesRes.data || [];
  allData.documents = documentsRes.data || [];
  allData.machine_docs = machineDocsRes.data || [];
  
  renderAdminTable();
  renderMachineTable();
  renderDocsList();
}

// --- MAKİNE EKLE ---
async function addMachine(serial, upper, lower) {
  const docCode = upper + '-' + serial;
  const { data, error } = await supabase.from('machines').insert({
    serial_number: serial,
    upper_serial: upper,
    lower_serial: lower,
    document_code: docCode
  }).select();
  
  if (error) return { isOk: false, error: error.message };
  await loadAllData();
  return { isOk: true };
}

// --- DOKÜMAN EKLE ---
async function addDocument(name, file, upperSerial, lowerSerial, docType, version, docCode) {
  const uploadDate = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('documents').insert({
    document_name: name,
    document_file: file,
    machine_model: lowerSerial,
    upper_serial: upperSerial,
    lower_serial: lowerSerial,
    document_type: docType,
    version_number: version,
    upload_date: uploadDate,
    document_code: docCode
  }).select();
  
  if (error) return { isOk: false, error: error.message };
  await loadAllData();
  return { isOk: true };
}

// --- DOKÜMAN SİL ---
async function deleteDocument(docId) {
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  if (error) return { isOk: false, error: error.message };
  await loadAllData();
  return { isOk: true };
}

// --- MAKİNEYE DOKÜMAN TANIMLA ---
async function assignDocumentToMachine(machineId, documentId) {
  const { data, error } = await supabase.from('machine_documents').insert({
    machine_id: machineId,
    document_id: documentId
  }).select();
  
  if (error) return { isOk: false, error: error.message };
  await loadAllData();
  return { isOk: true };
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function switchTab(tab) {
  currentAdminTab = tab;
  document.getElementById('open-add-form').setAttribute('data-action', tab === 'dokuman' ? 'add-document' : 'add-machine');
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab + '-content').classList.add('active');
  
  const btnDokuman = document.getElementById('tab-dokuman');
  const btnMakine = document.getElementById('tab-makine');
  const btnAddForm = document.getElementById('open-add-form');
  
  const btnSpan = btnAddForm.querySelector('span');

  if (tab === 'dokuman') {
    btnDokuman.className = "px-4 py-2 rounded-lg font-semibold transition bg-red-600 text-white shadow-sm";
    btnMakine.className = "px-4 py-2 rounded-lg font-semibold transition hover:bg-gray-100 text-gray-700 hover:text-red-600";
    if (btnSpan) btnSpan.textContent = "Yeni Doküman Ekle";
  } else {
    btnMakine.className = "px-4 py-2 rounded-lg font-semibold transition bg-red-600 text-white shadow-sm";
    btnDokuman.className = "px-4 py-2 rounded-lg font-semibold transition hover:bg-gray-100 text-gray-700 hover:text-red-600";
    if (btnSpan) btnSpan.textContent = "Yeni Makine Ekle";
  }
}

function generateDocumentCode() {
  const upperSerial = document.getElementById('admin-upper-serial').value.trim();
  const docType = document.getElementById('admin-doctype').value.trim();
  const version = document.getElementById('admin-version').value.trim();
  
  if (!upperSerial || !docType || !version) {
    document.getElementById('admin-doccode').value = '';
    return;
  }
  
  const typeCode = docTypeCodeMap[docType] || '';
  document.getElementById('admin-doccode').value = upperSerial + typeCode + version;
}

// Docs list for regular users
function renderDocsList() {
  const container = document.getElementById('docs-list');
  const empty = document.getElementById('docs-empty');

  const userMachine = allData.machines.find(m => m.serial_number === currentSerial);
  let filtered = [];
  
  if (userMachine) {
    const assignedIds = allData.machine_docs.filter(md => md.machine_id === userMachine.id).map(md => md.document_id);
    filtered = allData.documents.filter(d => assignedIds.includes(d.id));
  }

  if (filtered.length === 0 && currentModel) {
    filtered = allData.documents.filter(d => 
      d.lower_serial && d.lower_serial.toLowerCase().includes(currentModel.toLowerCase())
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  container.innerHTML = filtered.map(d => `
    <div class="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
      <div class="flex flex-col">
        <span class="font-bold text-gray-800">${esc(d.document_name)}</span>
        <span class="text-xs text-gray-500 font-medium">Model: ${esc(d.lower_serial)} | Kod: ${esc(d.document_code)}</span>
      </div>
      <a href="#" class="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition" onclick="alert('Dosya indiriliyor: ${esc(d.document_file)}')">
        <i data-lucide="download" style="width:16px;height:16px"></i> İndir
      </a>
    </div>`).join('');
  
  lucide.createIcons();
}

// Admin table
function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  const empty = document.getElementById('admin-empty');
  const docs = allData.documents || [];
  if (docs.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  tbody.innerHTML = docs.map(d => `
    <tr class="border-b hover:bg-gray-50 transition">
      <td class="px-4 py-3 font-medium text-gray-800">${esc(d.document_name)}</td>
      <td class="px-4 py-3">${esc(d.upper_serial)}</td>
      <td class="px-4 py-3">${esc(d.lower_serial)}</td>
      <td class="px-4 py-3"><span class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">${esc(d.document_type)}</span></td>
      <td class="px-4 py-3">${esc(d.version_number)}</td>
      <td class="px-4 py-3">${esc(d.upload_date)}</td>
      <td class="px-4 py-3 font-mono text-xs text-gray-500">${esc(d.document_code)}</td>
      <td class="px-4 py-3">
        <a href="#" onclick="alert('Demo: ${esc(d.document_file)} dosyası indiriliyor.')" class="underline text-red-600 hover:text-red-800 flex items-center gap-1 font-medium">
          <i data-lucide="download" style="width:14px;height:14px"></i> İndir
        </a>
      </td>
      <td class="px-4 py-3">
        <button type="button" class="text-gray-400 hover:text-red-600 transition" onclick="confirmDelete('${d.id}')" title="Sil">
          <i data-lucide="trash-2" style="width:18px;height:18px"></i>
        </button>
      </td>
    </tr>`).join('');
  
  lucide.createIcons();
}

function renderMachineTable() {
  const tbody = document.getElementById('machine-table-body');
  const empty = document.getElementById('machine-empty');
  if (!tbody || !empty) return;

  const machines = allData.machines || [];
  const docs = allData.documents || [];
  const machineDocs = allData.machine_docs || [];

  if (machines.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  let html = '';
  machines.forEach((m) => {
    html += `
      <tr class="bg-gray-50 font-semibold border-b-2 border-gray-300">
        <td class="px-4 py-3 text-gray-800">${esc(m.serial_number)}</td>
        <td class="px-4 py-3">${esc(m.upper_serial)}</td>
        <td class="px-4 py-3">${esc(m.lower_serial)}</td>
        <td class="px-4 py-3">—</td>
        <td class="px-4 py-3 font-mono text-xs text-gray-500">${esc(m.document_code)}</td>
        <td class="px-4 py-3">—</td>
        <td class="px-4 py-3">
          <button type="button" class="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium text-xs transition" onclick="openAssignDocModal('${m.id}')" title="Doküman Tanımla">
            <i data-lucide="plus-circle" style="width:16px;height:16px"></i> <span>Doküman Ekle</span>
          </button>
        </td>
      </tr>`;

    const assignedIds = machineDocs.filter(md => md.machine_id === m.id).map(md => md.document_id);
    const assignedDocs = docs.filter(d => assignedIds.includes(d.id));
    
    if (assignedDocs.length > 0) {
      assignedDocs.forEach(d => {
        html += `
          <tr class="border-b hover:bg-blue-50 transition bg-blue-50/30">
            <td class="px-4 py-2 pl-8 text-gray-500 text-xs italic">↳ ${esc(d.document_name || '-')}</td>
            <td class="px-4 py-2 text-xs">${esc(d.upper_serial || '-')}</td>
            <td class="px-4 py-2 text-xs">${esc(d.lower_serial || '-')}</td>
            <td class="px-4 py-2"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">${esc(d.document_type || '-')}</span></td>
            <td class="px-4 py-2 font-mono text-xs text-gray-500">${esc(d.document_code || '-')}</td>
            <td class="px-4 py-2">
              <a href="#" onclick="event.preventDefault(); alert('Demo: ${esc(d.document_file || 'Dosya')} indiriliyor.')" class="text-red-600 hover:text-red-800 flex items-center gap-1 text-xs font-medium">
                <i data-lucide="download" style="width:14px;height:14px"></i> İndir
              </a>
            </td>
            <td class="px-4 py-2"></td>
          </tr>`;
      });
    }
  });
  
  tbody.innerHTML = html;
  lucide.createIcons();
}

function openAssignDocModal(machineId) {
  assignTargetMachine = allData.machines.find(m => m.id === machineId);
  if (!assignTargetMachine) return;
  document.getElementById('assign-machine-serial-display').value = assignTargetMachine.serial_number;
  document.getElementById('assign-doc-code').value = '';
  document.getElementById('assign-status').classList.add('hidden');
  document.getElementById('assign-error').classList.add('hidden');
  document.getElementById('assign-doc-modal').classList.remove('hidden');
}

function confirmDelete(id) {
  deleteTarget = allData.documents.find(d => d.id === id);
  if (!deleteTarget) return;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
  lucide.createIcons();
  switchTab('dokuman');

  // Login
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const serial = document.getElementById('serial-input').value.trim();
    const model = document.getElementById('model-input').value.trim();
    if (!serial || !model) return;

    if (serial === 'admin' && model === 'dolfindoc') {
      showView('admin-view');
    } else {
      window.location.href = 'user.html?serial=' + encodeURIComponent(serial) + '&model=' + encodeURIComponent(model);
    }
  });

  // Help modal
  document.getElementById('help-btn').addEventListener('click', () => document.getElementById('help-modal').classList.remove('hidden'));
  document.getElementById('close-modal').addEventListener('click', () => document.getElementById('help-modal').classList.add('hidden'));

  // Open add form button
  document.getElementById('open-add-form').addEventListener('click', () => {
    const action = document.getElementById('open-add-form').getAttribute('data-action');
    if (action === 'add-document') {
      document.getElementById('add-modal').classList.remove('hidden');
      selectedFile = null;
      document.getElementById('file-name').textContent = 'Dosya Seçin';
    } else if (action === 'add-machine') {
      document.getElementById('add-machine-modal').classList.remove('hidden');
    }
  });

  // Assign modal close
  document.getElementById('close-assign-modal').addEventListener('click', () => {
    document.getElementById('assign-doc-modal').classList.add('hidden');
    assignTargetMachine = null;
  });
  document.getElementById('close-assign-modal-btn').addEventListener('click', () => {
    document.getElementById('assign-doc-modal').classList.add('hidden');
    assignTargetMachine = null;
  });

  // Assign document form
  document.getElementById('assign-doc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const docCode = document.getElementById('assign-doc-code').value.trim();
    
    if (!docCode) {
      document.getElementById('assign-error').textContent = 'Lütfen bir doküman kodu giriniz.';
      document.getElementById('assign-error').classList.remove('hidden');
      return;
    }
    
    const docRecord = allData.documents.find(d => d.document_code === docCode);
    
    if (!docRecord) {
      document.getElementById('assign-error').textContent = 'Bu kodla eşleşen bir doküman bulunamadı.';
      document.getElementById('assign-error').classList.remove('hidden');
      return;
    }
    
    const alreadyAssigned = allData.machine_docs.some(md => md.machine_id === assignTargetMachine.id && md.document_id === docRecord.id);
    if (alreadyAssigned) {
      document.getElementById('assign-error').textContent = 'Bu doküman zaten bu makineye tanımlanmış.';
      document.getElementById('assign-error').classList.remove('hidden');
      return;
    }
    
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    const result = await assignDocumentToMachine(assignTargetMachine.id, docRecord.id);
    
    if (result.isOk) {
      document.getElementById('assign-status').classList.remove('hidden');
      document.getElementById('assign-error').classList.add('hidden');
      document.getElementById('assign-doc-code').value = '';
      setTimeout(() => {
        document.getElementById('assign-status').classList.add('hidden');
        document.getElementById('assign-doc-modal').classList.add('hidden');
        assignTargetMachine = null;
      }, 2000);
    } else {
      document.getElementById('assign-error').textContent = result.error || 'Hata oluştu.';
      document.getElementById('assign-error').classList.remove('hidden');
    }
    
    btn.disabled = false;
    btn.style.opacity = '1';
  });

  // Machine modal close
  document.getElementById('close-add-machine-modal').addEventListener('click', () => document.getElementById('add-machine-modal').classList.add('hidden'));
  document.getElementById('close-add-machine-modal-btn').addEventListener('click', () => document.getElementById('add-machine-modal').classList.add('hidden'));
  
  // Add modal close
  document.getElementById('close-add-modal').addEventListener('click', () => document.getElementById('add-modal').classList.add('hidden'));
  document.getElementById('close-add-modal-btn').addEventListener('click', () => document.getElementById('add-modal').classList.add('hidden'));

  // File button
  document.getElementById('file-button').addEventListener('click', () => {
    document.getElementById('admin-file').click();
  });
  
  document.getElementById('admin-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      document.getElementById('file-name').textContent = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
    }
  });

  // Auto-generate document code
  document.getElementById('admin-upper-serial').addEventListener('change', generateDocumentCode);
  document.getElementById('admin-doctype').addEventListener('change', generateDocumentCode);
  document.getElementById('admin-version').addEventListener('change', generateDocumentCode);

  // Back buttons
  document.getElementById('docs-back').addEventListener('click', () => {
    document.getElementById('login-form').reset();
    showView('login-view');
  });
  document.getElementById('admin-back').addEventListener('click', () => {
    document.getElementById('login-form').reset();
    showView('login-view');
  });

  // Tab switching
  document.getElementById('tab-dokuman').addEventListener('click', () => switchTab('dokuman'));
  document.getElementById('tab-makine').addEventListener('click', () => switchTab('makine'));

  // Admin form submit
  document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('admin-docname').value.trim();
    const upperSerial = document.getElementById('admin-upper-serial').value.trim();
    const lowerSerial = document.getElementById('admin-lower-serial').value.trim();
    const docType = document.getElementById('admin-doctype').value.trim();
    const version = document.getElementById('admin-version').value.trim();
    const docCode = document.getElementById('admin-doccode').value.trim();
    
    if (!name || !upperSerial || !lowerSerial || !docType || !version || !selectedFile) {
      document.getElementById('admin-error').textContent = 'Lütfen tüm alanları doldurunuz ve dosya seçiniz.';
      document.getElementById('admin-error').classList.remove('hidden');
      return;
    }
    
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    const result = await addDocument(name, selectedFile.name, upperSerial, lowerSerial, docType, version, docCode);
    
    if (result.isOk) {
      document.getElementById('admin-status').classList.remove('hidden');
      document.getElementById('admin-error').classList.add('hidden');
      e.target.reset();
      selectedFile = null;
      document.getElementById('file-name').textContent = 'Dosya Seçin';
      document.getElementById('admin-doccode').value = '';
      setTimeout(() => {
        document.getElementById('admin-status').classList.add('hidden');
        document.getElementById('add-modal').classList.add('hidden');
      }, 2000);
    } else {
      document.getElementById('admin-error').textContent = result.error || 'Hata oluştu.';
      document.getElementById('admin-error').classList.remove('hidden');
    }
    
    btn.disabled = false;
    btn.style.opacity = '1';
  });

  // Confirm delete modal
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.add('hidden');
    deleteTarget = null;
  });
  
  document.getElementById('confirm-ok').addEventListener('click', async () => {
    if (!deleteTarget) return;
    const btn = document.getElementById('confirm-ok');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    await supabase.from('machine_documents').delete().eq('document_id', deleteTarget.id);
    await deleteDocument(deleteTarget.id);
    
    btn.disabled = false;
    btn.style.opacity = '1';
    document.getElementById('confirm-modal').classList.add('hidden');
    deleteTarget = null;
  });

  // Machine form submit
  document.getElementById('machine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const serial = document.getElementById('machine-serial').value.trim();
    const upper = document.getElementById('machine-upper').value.trim();
    const lower = document.getElementById('machine-lower').value.trim();
    
    if (!serial || !upper || !lower) {
      document.getElementById('machine-error').textContent = 'Lütfen tüm alanları doldurunuz.';
      document.getElementById('machine-error').classList.remove('hidden');
      return;
    }
    
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    const result = await addMachine(serial, upper, lower);
    
    if (result.isOk) {
      document.getElementById('machine-status').classList.remove('hidden');
      document.getElementById('machine-error').classList.add('hidden');
      e.target.reset();
      setTimeout(() => {
        document.getElementById('machine-status').classList.add('hidden');
        document.getElementById('add-machine-modal').classList.add('hidden');
      }, 2000);
    } else {
      document.getElementById('machine-error').textContent = result.error || 'Hata oluştu.';
      document.getElementById('machine-error').classList.remove('hidden');
    }
    
    btn.disabled = false;
    btn.style.opacity = '1';
  });
});
