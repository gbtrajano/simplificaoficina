// Harness exclusivo de gravação: não monta login/licença nem acessa o banco real.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { api } from '../src/lib/api';
import WorkshopShell from '../src/components/WorkshopShell';
import Dashboard from '../src/pages/Dashboard';
import OrdensServico from '../src/pages/OrdensServico';
import Orcamentos from '../src/pages/Orcamentos';
import Veiculos from '../src/pages/Veiculos';
import Produtos from '../src/pages/Produtos';
import Contas from '../src/pages/Contas';
import '../src/styles.css';

if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('Harness somente local');
const today = new Date().toISOString().slice(0, 10);
const customers = ['Cliente demonstração 01', 'Cliente demonstração 02', 'Cliente demonstração 03', 'Cliente demonstração 04'].map((name, index) => ({ id: index + 1, name, phone: '', document: '', notes: 'Cadastro fictício para demonstração' }));
const vehicles = [['Volkswagen','Polo','Prata'],['Chevrolet','Onix','Branco'],['Fiat','Argo','Cinza'],['Honda','Civic','Preto']].map(([brand, model, color], index) => ({id:index+1, customer_id:index+1,customer_name:customers[index].name,plate:`DEM${index}A01`,brand,model,color,year:'2022',mileage:35000+index*7200,notes:'Veículo de demonstração',created_at:today}));
const services = ['Revisão preventiva','Troca de óleo','Revisão do sistema de freios','Diagnóstico eletrônico'].map((name,i)=>({id:i+1,name,description:'Serviço de demonstração',price:[250,120,180,150][i],active:true,created_at:today}));
const products = ['Óleo de motor 5W30','Filtro de óleo','Pastilha de freio','Filtro de ar','Fluido de freio DOT 4','Kit de velas'].map((name,i)=>({id:i+1,name,category:['Lubrificantes','Filtros','Freios','Filtros','Freios','Ignição'][i],price:[49.9,35,180,48,39.9,120][i],cost:[30,20,100,25,20,75][i],stock:[24,18,8,12,10,6][i],min_stock:3,barcode:'',active:true,unit_type:'UN',scale_prefix:''}));
const orders = vehicles.map((v,i)=>({id:101+i,vehicle_id:v.id,customer_id:v.customer_id,plate:v.plate,vehicle_name:`${v.brand} ${v.model}`,customer_name:v.customer_name,status:['in_progress','approved','ready','waiting_parts'][i],priority:'normal',complaint:'Revisão do veículo e verificação preventiva.',diagnosis:'Inspeção inicial realizada.',services:services[i].name,parts:products[i].name,labor_total:services[i].price,parts_total:products[i].price,discount:0,total:services[i].price+products[i].price,promised_at:null,mechanic:['Mecânico 01','', 'Mecânico 02','Mecânico 01'][i],payment_method:'PIX',created_at:today,updated_at:today}));
const appointments = vehicles.slice(0,3).map((v,i)=>({id:i+1,customer_name:v.customer_name,phone:'',vehicle:`${v.brand} ${v.model}`,plate:v.plate,service:services[i].name,scheduled_at:`${today}T${['09:00','10:30','14:00'][i]}:00`,status:'scheduled',notes:'Demonstração',created_at:today}));
const accounts = ['Compra de peças','Material de manutenção','Serviços de revisão','Trocas de óleo'].map((description,i)=>({id:i+1,account_type:i<2?'payable':'receivable',description,amount:[980,240,1450,720][i],due_date:today,paid:i===1,paid_date:i===1?today:null,supplier_id:null,customer_id:null,notes:'Lançamento fictício',created_at:today}));
// Bloqueia explicitamente todas as operações; somente leituras em memória são liberadas.
for(const name of Object.keys(api)) (api as any)[name]=async()=>{throw new Error(`Operação bloqueada no ambiente de gravação: ${name}`)};
const copy = (value: unknown) => Promise.resolve(structuredClone(value));
Object.assign(api, {
  workshopDashboard:()=>copy({open_orders:4,in_progress:1,ready:1,today_appointments:3,month_revenue:28450,vehicles:4}),
  listVehicles:()=>copy(vehicles),listCustomers:()=>copy(customers),listProducts:()=>copy(products),listWorkshopServices:()=>copy(services),listAppointments:()=>copy(appointments),
  listServiceOrders:(status='')=>copy(status?orders.filter(o=>o.status===status):orders),
  listAccounts:(type:string)=>copy(accounts.filter(a=>a.account_type===type)),
  getStoreSettings:()=>copy({name:'Oficina demonstração',address:'',phone:'',cnpj:'',receipt_footer:''}),
  getCategories:()=>copy(['Lubrificantes','Filtros','Freios','Ignição']),
});
createRoot(document.getElementById('root')!).render(<HashRouter><WorkshopShell><Routes>
  <Route path="/" element={<Dashboard/>}/><Route path="/ordens" element={<OrdensServico/>}/><Route path="/orcamentos" element={<Orcamentos/>}/><Route path="/veiculos" element={<Veiculos/>}/><Route path="/pecas" element={<Produtos/>}/><Route path="/financeiro" element={<Contas/>}/>
</Routes></WorkshopShell></HashRouter>);
