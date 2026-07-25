import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// === PURI NIRWANA 3 LIST ===
const pnw3List = [
  // RW 14 (Blok A/B)
  { name: 'Habibur Yusuf', block: 'Blok AA' },
  { name: 'Kurniadi', block: 'Blok AA' },
  { name: 'Aisyah Kalika', block: 'Blok AB' },
  { name: 'Heri Subowo', block: 'Blok AC' },
  { name: 'Moch. Imron Rossyady', block: 'Blok AC' },
  { name: 'Lisiniawati Zamasi Ruko', block: 'Blok AM' },
  { name: 'Lisiniawati Zamasi (Ruko)', block: 'Blok AM' },
  { name: 'Atus Sutisna', block: 'Blok BA' },
  { name: 'Hikmawati', block: 'Blok BA' },
  { name: 'Rizky Rudiansyah', block: 'Blok BA' },
  { name: 'Aznal Mad Hattari', block: 'Blok BB' },
  { name: 'Anastasya Probo Tugaswati', block: 'Blok BB' },
  { name: 'Lusy Tyagita', block: 'Blok BD' },
  { name: 'Muhammad Ali', block: 'Blok BD' },
  { name: 'Widiyastuti', block: 'Blok BD' },
  { name: 'Fajar Muchdani', block: 'Blok BF' },
  { name: 'Ali Sandi', block: 'Blok BJ' },
  { name: 'Bhastyo Ramadhan', block: 'Blok BJ' },
  { name: 'Ganda Prayitno', block: 'Blok BJ' },
  { name: 'Ir. Eben Marthin J. Lengkong', block: 'Blok BJ' },
  { name: 'Nida Fauziyah', block: 'Blok BJ' },
  { name: 'Ratih Shintia Putri', block: 'Blok BJ' },
  { name: 'Wahid Mahfuzi', block: 'Blok BJ' },
  { name: 'Rizki Mustika Martdiena Yanti', block: 'Blok BK' },
  { name: 'Supriyadi', block: 'Blok BK' },
  { name: 'Edward Juniadi Hayi', block: 'Blok BL' },
  { name: 'Muput Purnomowati', block: 'Blok BL' },
  { name: 'Fitho Daturametel', block: 'Blok BN' },
  { name: 'Tommi Fardiansyah', block: 'Blok BO' },
  { name: 'Ahmad Wibowo', block: 'Blok BP' },
  { name: 'Dedeh Hindasah', block: 'Blok BP' },
  { name: 'Samsudin', block: 'Blok BP' },
  { name: 'Sodikun', block: 'Blok BP' },
  { name: 'Melvania Gifa Hantari', block: 'Blok BQ' },
  { name: 'Tirto Apriyanto', block: 'Blok BQ' },
  { name: 'Adang Efendi', block: 'Blok BS' },
  { name: 'Yaya Suhaya', block: 'Blok BS' },
  { name: 'Edi Sumardi', block: 'Blok BU' },
  { name: 'Nurhayati', block: 'Blok BU' },
  { name: 'Salwa Salsabil', block: 'Blok BU' },

  // RW 15 (Blok C)
  { name: 'Fata Allam Hanifa', block: 'Blok CB' },
  { name: 'Andhika Aditya Putra', block: 'Blok CC' },
  { name: 'Ary Agustiamanto', block: 'Blok CC' },
  { name: 'I Gede Nyoman Antara', block: 'Blok CC' },
  { name: 'Sucipto', block: 'Blok CC' },
  { name: 'Sumantri Ali Habibi', block: 'Blok CC' },
  { name: 'Abdul Rosyad', block: 'Blok CD' },
  { name: 'Agus Mulyana', block: 'Blok CD' },
  { name: 'Ajen Zaenul Haq', block: 'Blok CD' },
  { name: 'Faiz Arifandy', block: 'Blok CD' },
  { name: 'Hotman P Batuara', block: 'Blok CD' },
  { name: 'Marwan Setiawan', block: 'Blok CD' },
  { name: 'Nurhayati Asa', block: 'Blok CE' },
  { name: 'Pri Ratu Angin', block: 'Blok CE' },
  { name: 'Reyhan Eki Grahadi', block: 'Blok CE' },
  { name: 'Sri Nila Susanti', block: 'Blok CE' },
  { name: 'Geril Valdo Jatsiah Manday', block: 'Blok CE' },
  { name: 'Alvin Setiawan', block: 'Blok CF' },
  { name: 'Bukhari Bolang', block: 'Blok CF' },
  { name: 'Chestariani Ayu Triwahyuni', block: 'Blok CF' },
  { name: 'Gabe Virton Jeriko', block: 'Blok CF' },
  { name: 'Untung Priyanto', block: 'Blok CF' },
  { name: 'Zidan Caturiansyah', block: 'Blok CF' },
  { name: 'Atin Ngatini', block: 'Blok CG' },
  { name: 'Erritetti Sitompul', block: 'Blok CG' },
  { name: 'Muhammad Agung Setiawan', block: 'Blok CG' },
  { name: 'Sulthan', block: 'Blok CG' },
  { name: 'Tito Shadam Fatwiandika Husein', block: 'Blok CG' },
  { name: 'Tri Sulistyorini', block: 'Blok CG' },
  { name: 'Lodewyk Sibarani', block: 'Blok CG' },
  { name: 'Betty Riama Simatupang', block: 'Blok CH' },
  { name: 'Budiman', block: 'Blok CH' },
  { name: 'Eska Perdana Prasetya', block: 'Blok CH' },
  { name: 'Jelita Florencia', block: 'Blok CH' },
  { name: 'Dini Agustini', block: 'Blok CH' },
  { name: 'Ifan Kustiawan', block: 'Blok CI' },
  { name: 'Miftahur Rosyad', block: 'Blok CI' },
  { name: 'Rulin Pasaribu', block: 'Blok CI' },
  { name: 'Indra Dwi Prakoso', block: 'Blok CI' },
  { name: 'Alfisyarah Prihatini Sulita', block: 'Blok CJ' },
  { name: 'Chynthia Permata Ginting', block: 'Blok CJ' },
  { name: 'Hanidah Fauziah', block: 'Blok CJ' },
  { name: 'Muhammad Muchtar', block: 'Blok CJ' },
  { name: 'Novia Hastaria', block: 'Blok CJ' },
  { name: 'Tuti', block: 'Blok CJ' },
  { name: 'Ade Suryani', block: 'Blok CL' },
  { name: 'M Cerri Riandi', block: 'Blok CL' },
  { name: 'Mulyanto', block: 'Blok CL' },
  { name: 'Rina Haeriah', block: 'Blok CL' },
  { name: 'Tia Lestari', block: 'Blok CL' },

  // RW 16 (Blok D)
  { name: 'Armen', block: 'Blok D' },
  { name: 'Benny Sulaiman', block: 'Blok D' },
  { name: 'Farsa Justi M', block: 'Blok D' },
  { name: 'Lisiniawati Zamasi', block: 'Blok D' },
  { name: 'Rizki Romadityo', block: 'Blok D' },
  { name: 'Ahmad Zulfikar', block: 'Blok D' },
  { name: 'Muslim', block: 'Blok DA' },
  { name: 'Yuli Inawaty', block: 'Blok DB' },
  { name: 'Putra Gabe Martogi', block: 'Blok DC' },
  { name: 'Akeheto Barua', block: 'Blok DF' },
  { name: 'Indra', block: 'Blok DF' },
  { name: 'Zaenal Abidin', block: 'Blok DF' },
  { name: 'Arif Akbar', block: 'Blok DG' },
  { name: 'Eko Wahyudi', block: 'Blok DG' },
  { name: 'Ferdi Al Iqbal', block: 'Blok DG' },
  { name: 'Sumarwan', block: 'Blok DG' },
  { name: 'Bobby Rachman Saputra', block: 'Blok DH' },
  { name: 'Siti Khodijatus Solihah', block: 'Blok DH' },
  { name: 'Agil Purnomo', block: 'Blok DI' },
  { name: 'Sri Wuryanto', block: 'Blok DJ' },
  { name: 'Ahmad Syaiful', block: 'Blok DL' },
  { name: 'Dendra Nurshaftiawan', block: 'Blok DL' },
  { name: 'Mama Theo', block: 'Blok DL' },
  { name: 'Yusapat Wadyowusono', block: 'Blok DL' },
  { name: 'Agus Hermawan', block: 'Blok DM' },
  { name: 'Dian Rusdiansyah', block: 'Blok DM' },
  { name: 'Dimas Arya Dwi A', block: 'Blok DM' },
  { name: 'Hartono', block: 'Blok DM' },
  { name: 'Hayadi', block: 'Blok DM' },
  { name: 'Iryana Suyudi', block: 'Blok DM' },
  { name: 'Megy Anggraini', block: 'Blok DM' },
  { name: 'Mohammad Iqbal', block: 'Blok DM' },
  { name: 'Siti Nuriah', block: 'Blok DM' },
  { name: 'Eka Wulansari', block: 'Blok DN' },
  { name: 'Maria Aprilningsih', block: 'Blok DN' },
  { name: 'Paryono', block: 'Blok DN' },
  { name: 'Rudisman', block: 'Blok DN' },
  { name: 'Rizky Alfiana', block: 'Blok DN' },
  { name: 'Sumadi', block: 'Blok DN' },
  { name: 'Tri Yatmi Mustika', block: 'Blok DN' },
  { name: 'Novera Listiana', block: 'Blok DN' },
  { name: 'Syaiful Anwar', block: 'Blok DO' },
  { name: 'Ade Ari Febri Andi', block: 'Blok DP' },
  { name: 'Safruddin Munandar', block: 'Blok DP' },
  { name: 'Siti Latifah', block: 'Blok DP' },
  { name: 'Yesi Rusdiarti', block: 'Blok DQ' },
  { name: 'Ady Fadillah', block: 'Blok DS' },
  { name: 'Eko Nur Widodo', block: 'Blok DS' },
  { name: 'Fina Anggarini', block: 'Blok DT' },
  { name: 'Ansori', block: 'Blok DU' },
  { name: 'Andika Putra Nugraha', block: 'Blok DU' },
  { name: 'Bayu Asmoro', block: 'Blok DU' },
  { name: 'Deden Kurnia', block: 'Blok DU' },
  { name: 'Dewiana', block: 'Blok DU' },
  { name: 'Krisna Murti', block: 'Blok DU' },
  { name: 'Nurianty Tarigan', block: 'Blok DU' },
  { name: 'Robby Eko Atmojo', block: 'Blok DU' },
  { name: 'Suci N Tsadiyah', block: 'Blok DU' },
  { name: 'Tumino', block: 'Blok DU' },
  { name: 'Muhammad Rayhan Deka', block: 'Blok DU' },
  { name: 'Ruslianto', block: 'Blok DV' },
  { name: 'Herry Syahriban', block: 'Blok DW' },
  { name: 'Putut Agus Purwanto', block: 'Blok DW' },
  { name: 'Fitri Helmi', block: 'Blok DX' },

  // No block
  { name: 'Asep Kastiadi', block: 'RW16 Pos Biru' },
];

// === KAMPUNG PISANG LIST ===
const kpsList = [
  'A Sabeni', 'Abdulah', 'Ade Nisa', 'Ahmad Ibrahim Rangkuty', 'Alfin Setiawan',
  'Amanda Adelia Putri', 'Andi KPS', 'Andriansyah', 'Agus', 'Agus Prasetiyo',
  'Alif Dafa Al Raffi', 'Ami', 'Annisa Purnamasari', 'Ari Akbari Pratama', 'Arif Budiman',
  'Bintang', 'Dewi Ismayanti', 'Dina Lorinsa', 'Derie Wibowo', 'Dwi Astuti',
  'Dwi Sunardi Setiabudi', 'Eko Bowie', 'Ermawati Anisya', 'Erna Restiana', 'Egie Sukma',
  'Emawati', 'Eneng Rosdiana', 'Enjum Jaelani', 'Entih Putri Rahayu', 'Fajar Ginanjar',
  'Febri Nur Indah Safitri', 'Fera Nurjanah', 'Herdi Prakoso', 'Ida Lumba Raja', 'Jakaria',
  'Karnadi', 'Lutfi Prasetyo', 'Lastiurma', 'Lia Nuraini', 'M Alif Pratama',
  'Maah', 'Mahpudin', 'Meika Harmani', 'Melana (Salon Jimey)', 'Melana', 'Muanih',
  'Muhammad Dastine', 'Muhammad (312367)', 'MUHAMMAD | 312367', 'Mad Yahya', 'Mega Ananda',
  'Meinovita', 'Misyati', 'Muhamad Reza Syuhada', 'Muhammad Febrian', 'Nirocha',
  'Nurjannah', 'Nabawi', 'Naryati', 'Nimas Fadilah', 'Nurhayani',
  'Nurhudin', 'Oktafia Syafiatun Nisa', 'Priyati', 'PT. Karyaindo Inovasi Utama', 'Putri Indah Mawarni',
  'Pipih Sopiah', 'R Muhammad Imran Rosyadi', 'Rahayu', 'Rahmat Hidayat', 'Rahmat Mubarok',
  'Rani Adriani Lestari', 'Retno Wati', 'Rini Sugiati', 'Riska', 'Saepul Anwar',
  'Saepul Rahman', 'Salbyah', 'Saman', 'Samsudin', 'Sansan Abdul Fatah',
  'Sri Lestari KPS', 'Suryanih', 'Salsabilla', 'Satiyah', 'Siti Hamidah',
  'Siti Mariam', 'Sumi', 'Tati Sumiyati', 'Tetti Tanjung', 'Yudi Permana',
  'Yuli Yanti', 'Beritakan Hia', 'Dwi Laras Sati', 'Faysal Anwar', 'Misan Yunus',
  'Nasir', 'Nina Febriyanti'
];

async function main() {
  console.log('=== Comprehensive Area Seeding for EugineBill ===');

  // 1. Get or create Target Areas
  let pnw3Area = await prisma.pppoeArea.findFirst({ where: { name: { contains: 'PURI NIRWANA' } } });
  if (!pnw3Area) {
    pnw3Area = await prisma.pppoeArea.create({
      data: { id: crypto.randomUUID(), name: 'PURI NIRWANA 3', description: 'Wilayah Coverage Puri Nirwana 3' }
    });
  }

  let kpsArea = await prisma.pppoeArea.findFirst({ where: { name: { contains: 'PISANG' } } });
  if (!kpsArea) {
    kpsArea = await prisma.pppoeArea.create({
      data: { id: crypto.randomUUID(), name: 'KAMPUNG PISANG', description: 'Wilayah Coverage Kampung Pisang' }
    });
  }

  const allUsers = await prisma.pppoeUser.findMany({
    select: { id: true, name: true, username: true, address: true, areaId: true }
  });

  const normalize = (str: string) => str.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  let pnw3Count = 0;
  let kpsCount = 0;

  // 2. Seed PURI NIRWANA 3
  console.log('\n--- Seeding PURI NIRWANA 3 ---');
  for (const item of pnw3List) {
    const itemNorm = normalize(item.name);
    const matched = allUsers.filter(u => normalize(u.name) === itemNorm || normalize(u.username) === itemNorm);

    for (const u of matched) {
      const currentAddr = u.address || '';
      const newAddr = currentAddr.includes(item.block) ? currentAddr : `${currentAddr} (${item.block}, Puri Nirwana 3)`.trim();
      
      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: {
          areaId: pnw3Area.id,
          address: newAddr,
        }
      });
      pnw3Count++;
      console.log(`✓ [PURI NIRWANA 3] ${u.name} (${u.username}) -> ${item.block}`);
    }
  }

  // 3. Seed KAMPUNG PISANG
  console.log('\n--- Seeding KAMPUNG PISANG ---');
  for (const nameStr of kpsList) {
    const itemNorm = normalize(nameStr);
    const matched = allUsers.filter(u => normalize(u.name) === itemNorm || normalize(u.username) === itemNorm);

    for (const u of matched) {
      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: {
          areaId: kpsArea.id,
        }
      });
      kpsCount++;
      console.log(`✓ [KAMPUNG PISANG] ${u.name} (${u.username})`);
    }
  }

  console.log(`\n=== Seeding Finished ===`);
  console.log(`PURI NIRWANA 3: ${pnw3Count} users updated.`);
  console.log(`KAMPUNG PISANG: ${kpsCount} users updated.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
