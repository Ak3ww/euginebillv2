import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const kmbCustomerList = [
  { name: 'Adi Firmansyah', address: 'Indah Kirana Residence Blok A11, RT05/RW01' },
  { name: 'Adi Kholilah', address: 'Indah Kirana Residence Blok B4' },
  { name: 'Agus Gunawan', address: 'Muara Beres RT03/RW01' },
  { name: 'Agus Mulyadi', address: 'Muara Beres RT01/RW01' },
  { name: 'Ahmad Wahyudin', address: 'Muara Beres RT01/RW01' },
  { name: 'Amalia Rahmadani', address: 'Muara Beres RT003/RW001 No.71' },
  { name: 'Andi Setiawan', address: 'Muara Beres RT01/RW01' },
  { name: 'Andriansyah', address: 'Muara Beres RT01/RW01' },
  { name: 'Anita Amelia', address: 'Muara Beres RT001/001 No.53' },
  { name: 'Ariesta Mirada', address: 'Indah Kirana Residence Blok D4, RT05/RW01' },
  { name: 'Arif Mubarogo', address: 'RT01/RW01 Sukahati' },
  { name: 'Aziz', address: 'Muara Beres RT/RW 03/01' },
  { name: 'Bayyinuri', address: 'Muara Beres RT001/001' },
  { name: 'Biyadial Khair', address: 'Kontrakan Bumi RH No.3, Jl Pamel II RT3/RW1' },
  { name: 'Baiq Rohatni Juliana', address: 'Muara Beres Jl.H.Minang RT01/01' },
  { name: 'Bayu Gilang Pratama', address: 'Muara Beres RT03/01' },
  { name: 'Dadang Teguh Ny', address: 'Indah Kirana Residence Blok C5, RT05/RW01' },
  { name: 'Dedy Tjahjono', address: 'Indah Kirana Residence Blok B No.1' },
  { name: 'Della Ryandani', address: 'Muara Beres RT003/001' },
  { name: 'Eneng Tin', address: 'Muara Beres RW1/RT1' },
  { name: 'Fanny Fardiansyah', address: 'Jl. H Minang No.4, RT01/01' },
  { name: 'Feri Ferdian', address: 'Muara Beres RT001/RW001' },
  { name: 'Gilang Saputra', address: 'Muara Beres RT03/RW01' },
  { name: 'Gina Dian Tika', address: 'Indah Kirana Residence Blok B29' },
  { name: 'Gita Yupita Sari', address: 'Jl H Minang, RT01/RW01' },
  { name: 'Hendar', address: 'Muara Beres Jl.H.Minang No.119, RT01/RW01' },
  { name: 'Ihsan Rasyid Rabbani', address: 'Muara Beres RT002/RW001' },
  { name: 'Ida Juanti', address: 'Jl. Family RT03/RW02 Muara Beres' },
  { name: 'Jami', address: 'Muara Beres RT01/RW01' },
  { name: 'Karina Yuniar', address: 'Muara Beres RT01/RW01' },
  { name: 'Kiki Amelia', address: 'Muara Beres RT01/RW01' },
  { name: 'Lukmanul Hakim', address: 'Jl Hj Minang RT/RW 03/01' },
  { name: 'Latifah Bahrum', address: 'Muara Beres RT/RW 02/01' },
  { name: 'Muhammad', address: 'Muara Beres RT/RW 001/001' },
  { name: 'Muhammad Akmal Falih Rizqilullah', address: 'Jl. H. Minang No.48, RT002/RW001' },
  { name: 'Muhammad Juhdi', address: 'Muara Beres RT/RW 001/001 (samping Indomaret)' },
  { name: 'Muhammad Rafli', address: 'Muara Beres RT03/RW01' },
  { name: 'Maryanih', address: 'Muara Beres RW01' },
  { name: 'Muhammad Ramadhani', address: 'Jl.H.Minang RT01/01' },
  { name: 'Muhammad Zaky', address: 'RT03/RW01 Muara Beres' },
  { name: 'Novi Rahmadhani', address: 'Muara Beres RT01/RW01 (belakang posyandu)' },
  { name: 'Nendar Sunandar', address: 'Muara Beres RT01/RW01' },
  { name: 'Nur Rohman', address: 'Muara Beres RT01/RW01' },
  { name: 'Rayhan Sep Dwi Putra', address: 'Muara Beres Jl H Minang RT003/001' },
  { name: 'Rahmat Nugraha', address: 'Muara Beres No.28, RT/RW 003/001' },
  { name: 'Ramadhan', address: 'Muara Beres RT1/RW1' },
  { name: 'Rudy Pasaribu', address: 'Muara Beres RT03/RW01' },
  { name: 'Rudy Sukmana', address: 'Muara Beres RT03/RW01' },
  { name: 'Septian Wijaya', address: 'Indah Kirana Blok B13' },
  { name: 'Sigit Prayogi', address: 'Jl Raya Sukahati RT04/RW02' },
  { name: 'Siti Aminah', address: 'Muara Beres RT01/RW01' },
  { name: 'Siti Khotijah', address: 'Muara Beres RT/RW 03/01' },
  { name: 'Siti Patimah', address: 'Muara Beres RT01/RW01' },
  { name: 'Sultan', address: 'Muara Beres RT01/RW01' },
  { name: 'Syifa Amalia', address: 'Muara Beres RT01/RW01' },
  { name: 'Tia Maulina', address: 'Muara Beres RT01/RW01' },
  { name: 'Tubagus Rakha', address: 'Indah Kirana Residence Blok A2' },
  { name: 'Vicky', address: 'Jl. Safire, RT03/RW02' },
  { name: 'Wahyudin', address: 'Muara Beres RT001/RW001' },
  { name: 'Yunus', address: 'Indah Kirana Residence Blok B24' },
  { name: 'Yunus POS', address: 'Indah Kirana Residence Blok B24' },
  { name: 'Feri Andriyanto', address: 'Muara Beres RT02/01' },
];

async function main() {
  console.log('=== Seeding 62 Customers to KAMPUNG MUARA BERES ===');

  // Ensure KAMPUNG MUARA BERES area exists
  let targetArea = await prisma.pppoeArea.findFirst({
    where: {
      name: { contains: 'MUARA BERES' }
    }
  });

  if (!targetArea) {
    targetArea = await prisma.pppoeArea.create({
      data: {
        id: crypto.randomUUID(),
        name: 'KAMPUNG MUARA BERES',
        description: 'Wilayah Coverage Kampung Muara Beres',
      }
    });
    console.log(`Created new area: ${targetArea.name}`);
  } else {
    console.log(`Using existing area: ${targetArea.name} (${targetArea.id})`);
  }

  const allUsers = await prisma.pppoeUser.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      address: true,
      areaId: true,
    }
  });

  let matchedCount = 0;
  let updatedCount = 0;

  for (const item of kmbCustomerList) {
    const itemNorm = item.name.trim().toLowerCase();
    
    // Exact or close match by name or username
    const matchedUsers = allUsers.filter(u => {
      const uName = (u.name || '').trim().toLowerCase();
      const uUsername = (u.username || '').trim().toLowerCase();
      return uName === itemNorm || uUsername === itemNorm || uName.includes(itemNorm) || itemNorm.includes(uName);
    });

    if (matchedUsers.length === 0) {
      console.log(`❌ No match found in DB for: "${item.name}"`);
      continue;
    }

    matchedCount++;

    for (const u of matchedUsers) {
      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: {
          areaId: targetArea.id,
          // Update address if current address is empty or generic
          address: (!u.address || u.address.length < 5) ? item.address : u.address,
        }
      });
      updatedCount++;
      console.log(`✓ [Matched & Assigned] ${u.name} (${u.username}) -> KAMPUNG MUARA BERES`);
    }
  }

  console.log(`\nDone! Matched ${matchedCount}/${kmbCustomerList.length} list items. Total ${updatedCount} user records updated.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
