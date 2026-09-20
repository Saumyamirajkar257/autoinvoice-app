let clients = [
  {id:1, company:"Google", contact:"John", email:"john@gmail.com", country:"United States", phone:"9999999999"}
];

let invoices = [
  {id:"INV-002", client:"Google", amount:1500, status:"sent", created:"18 Sep 2025", due:"18 Oct 2025"},
  {id:"INV-001", client:"Google", amount:708, status:"paid", created:"18 Sep 2025", due:"18 Oct 2025"}
];

function showPage(pageName, clickedLink){
  document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
  document.getElementById(pageName).classList.remove("hidden");

  if(clickedLink){
    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
    clickedLink.classList.add("active");
  }
  if(pageName === "clients") renderClients();
  if(pageName === "invoices") renderInvoices();
  if(pageName === "create") updateClientSelect();
  if(pageName === "dashboard") renderDashboard();
}

function money(value){
  return "$" + Number(value).toFixed(2);
}

function calculateInvoice(){
  const quantity = Number(document.getElementById("quantity").value) || 0;
  const rate = Number(document.getElementById("rate").value) || 0;
  const discountRate = Number(document.getElementById("discount").value) || 0;
  const taxRate = Number(document.getElementById("tax").value) || 0;

  const subtotal = quantity * rate;
  const discount = subtotal * discountRate / 100;
  const taxable = subtotal - discount;
  const tax = taxable * taxRate / 100;
  const total = taxable + tax;

  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("discountAmount").textContent = money(discount);
  document.getElementById("taxAmount").textContent = money(tax);
  document.getElementById("total").textContent = money(total);
}

function createInvoice(){
  const client = document.getElementById("invoiceClient").value;
  const description = document.getElementById("description").value.trim();
  const totalText = document.getElementById("total").textContent;
  const total = Number(totalText.replace("$",""));

  if(!description){
    alert("Please enter an invoice description.");
    return;
  }

  const newNumber = "INV-" + String(invoices.length + 1).padStart(3,"0");

  invoices.unshift({
    id:newNumber,
    client:client,
    amount:total,
    status:"sent",
    created:new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),
    due:document.getElementById("dueDate").value || "Not set"
  });

  alert("Invoice created successfully!");
  document.getElementById("description").value = "";
  document.getElementById("rate").value = 0;
  calculateInvoice();
  showPage("invoices");
}

function addClient(){
  const company = prompt("Enter company name:");
  if(!company) return;

  const contact = prompt("Enter contact name:") || "";
  const email = prompt("Enter email:") || "";

  clients.push({
    id:Date.now(),
    company:company,
    contact:contact,
    email:email,
    country:"India",
    phone:"Not Added"
  });

  renderClients();
  renderDashboard();
  alert("Client added successfully!");
}

function renderClients(){
  const search = (document.getElementById("clientSearch")?.value || "").toLowerCase();
  const table = document.getElementById("clientTable");

  table.innerHTML = "";

  clients
    .filter(c => `${c.company} ${c.contact} ${c.email}`.toLowerCase().includes(search))
    .forEach(client => {
      table.innerHTML += `
        <tr>
          <td>${client.company}</td>
          <td>${client.contact}</td>
          <td>${client.email}</td>
          <td>${client.country}</td>
          <td>${client.phone}</td>
          <td><button onclick="removeClient(${client.id})">Delete</button></td>
        </tr>`;
    });
}

function removeClient(id){
  if(!confirm("Delete this client?")) return;
  clients = clients.filter(c => c.id !== id);
  renderClients();
  renderDashboard();
}

function renderInvoices(){
  const search = (document.getElementById("invoiceSearch")?.value || "").toLowerCase();
  const table = document.getElementById("invoiceTable");

  table.innerHTML = "";

  invoices
    .filter(i => `${i.id} ${i.client}`.toLowerCase().includes(search))
    .forEach(invoice => {
      table.innerHTML += `
        <tr>
          <td>${invoice.id}</td>
          <td>${invoice.client}</td>
          <td>${money(invoice.amount)}</td>
          <td><span class="status ${invoice.status}">${invoice.status}</span></td>
          <td>${invoice.created}</td>
          <td>${invoice.due}</td>
        </tr>`;
    });
}

function renderDashboard(){
  const paid = invoices.filter(i => i.status === "paid")
                       .reduce((sum,i) => sum + i.amount, 0);

  const pending = invoices.filter(i => i.status === "sent")
                           .reduce((sum,i) => sum + i.amount, 0);

  document.getElementById("totalInvoices").textContent = invoices.length;
  document.getElementById("totalRevenue").textContent = money(paid);
  document.getElementById("pendingAmount").textContent = money(pending);
  document.getElementById("totalClients").textContent = clients.length;

  document.getElementById("recentInvoices").innerHTML = invoices.slice(0,4).map(invoice => `
    <div class="invoice-row">
      <div>
        <strong>${invoice.id}</strong>
        <p>${invoice.client}</p>
        <small>${invoice.created} • Due ${invoice.due}</small>
      </div>
      <div>
        <strong>${money(invoice.amount)}</strong>
        <span class="status ${invoice.status}">${invoice.status}</span>
      </div>
    </div>
  `).join("");
}

function updateClientSelect(){
  const select = document.getElementById("invoiceClient");
  select.innerHTML = clients.map(c => `<option>${c.company}</option>`).join("");
}

function deleteAccount(){
  if(confirm("Are you sure you want to delete your account?")){
    alert("Account deletion request submitted.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();
  renderClients();
  renderInvoices();
  updateClientSelect();
  calculateInvoice();
});
