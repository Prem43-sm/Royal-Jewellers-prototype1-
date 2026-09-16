import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const ownerPassword = await bcrypt.hash('admin123', 10);
  const managerPassword = await bcrypt.hash('manager123', 10);
  const staffPassword = await bcrypt.hash('staff123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'admin@jewellery.com' },
    update: {},
    create: {
      name: 'Owner',
      email: 'admin@jewellery.com',
      passwordHash: ownerPassword,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@jewellery.com' },
    update: {},
    create: {
      name: 'Manager',
      email: 'manager@jewellery.com',
      passwordHash: managerPassword,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@jewellery.com' },
    update: {},
    create: {
      name: 'Staff',
      email: 'staff@jewellery.com',
      passwordHash: staffPassword,
      role: 'STAFF',
      status: 'ACTIVE',
    },
  });

  const categories = ['Ring', 'Necklace', 'Bracelet', 'Bangle', 'Earring', 'Pendant', 'Chain', 'Anklet', 'Nose Pin', 'Mangalsutra', 'Wedding Band', 'Charm', 'Brooch', 'Set'];
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rates = [
    { metal: 'GOLD', purity: 22, buyRate: 7200, sellRate: 7400 },
    { metal: 'GOLD', purity: 18, buyRate: 5900, sellRate: 6100 },
    { metal: 'GOLD', purity: 24, buyRate: 8100, sellRate: 8300 },
    { metal: 'SILVER', purity: 100, buyRate: 85, sellRate: 90 },
  ];

  for (const r of rates) {
    const existing = await prisma.metalRate.findFirst({
      where: { metal: r.metal, purity: r.purity, createdAt: { gte: todayStart } },
    });
    if (!existing) {
      await prisma.metalRate.create({ data: r });
    }
  }

  const customers = [
    { name: 'Ravi Kumar', phone: '9876543210', email: 'ravi@email.com', address: 'Mumbai, Maharashtra' },
    { name: 'Priya Sharma', phone: '9876543211', address: 'Delhi, NCR' },
    { name: 'Amit Patel', phone: '9876543212', address: 'Ahmedabad, Gujarat' },
    { name: 'Sunita Devi', phone: '9876543213', address: 'Jaipur, Rajasthan' },
    { name: 'Arjun Singh', phone: '9876543214', address: 'Bangalore, Karnataka' },
  ];

  const createdCustomers = [];
  for (const c of customers) {
    const customer = await prisma.customer.create({ data: c });
    createdCustomers.push(customer);
  }

  const suppliers = [
    { name: 'Mumbai Gold Traders', contactPerson: 'Mahesh Mehta', phone: '9876543400', address: 'Mumbai, Maharashtra' },
    { name: 'Kolkata Jewellery House', contactPerson: 'Sunil Agarwal', phone: '9876543401', address: 'Kolkata, West Bengal' },
    { name: 'Chennai Silver Supply Co.', contactPerson: 'Lakshmi', phone: '9876543402', address: 'Chennai, Tamil Nadu' },
  ];

  const createdSuppliers = [];
  for (const s of suppliers) {
    const supplier = await prisma.supplier.create({ data: s });
    createdSuppliers.push(supplier);
  }

  const sampleProducts = [
    { name: 'Gold Ring 22K Plain', metal: 'GOLD', purity: 22, grossWeight: 8.5, makingCharge: 250, wastagePercent: 3, supplierIdx: 0 },
    { name: 'Gold Necklace 22K', metal: 'GOLD', purity: 22, grossWeight: 35.2, makingCharge: 450, wastagePercent: 3, supplierIdx: 0 },
    { name: 'Gold Bangle 22K', metal: 'GOLD', purity: 22, grossWeight: 25.0, makingCharge: 350, wastagePercent: 3, supplierIdx: 0 },
    { name: 'Gold Earrings 22K', metal: 'GOLD', purity: 22, grossWeight: 5.2, makingCharge: 200, wastagePercent: 3, supplierIdx: 1 },
    { name: 'Gold Chain 22K', metal: 'GOLD', purity: 22, grossWeight: 15.0, makingCharge: 300, wastagePercent: 3, supplierIdx: 1 },
    { name: 'Gold Mangalsutra 22K', metal: 'GOLD', purity: 22, grossWeight: 12.0, makingCharge: 280, wastagePercent: 3, supplierIdx: 0 },
    { name: 'Gold Pendant 18K Diamond', metal: 'GOLD', purity: 18, grossWeight: 4.5, stoneWeight: 0.5, stoneType: 'Diamond', stoneCharge: 15000, makingCharge: 500, wastagePercent: 2, supplierIdx: 1 },
    { name: 'Silver Coin 100g', metal: 'SILVER', purity: 100, grossWeight: 100, makingCharge: 50, wastagePercent: 1, supplierIdx: 2 },
    { name: 'Silver Bangle', metal: 'SILVER', purity: 92, grossWeight: 45, makingCharge: 80, wastagePercent: 2, supplierIdx: 2 },
    { name: 'Gold Wedding Band 22K', metal: 'GOLD', purity: 22, grossWeight: 6.0, makingCharge: 300, wastagePercent: 3, supplierIdx: 0 },
    { name: 'Gold Bracelet 22K', metal: 'GOLD', purity: 22, grossWeight: 22.0, makingCharge: 400, wastagePercent: 3, supplierIdx: 1 },
    { name: 'Gold Anklet 22K', metal: 'GOLD', purity: 22, grossWeight: 18.0, makingCharge: 350, wastagePercent: 3, supplierIdx: 0 },
  ];

  let count = 0;
  for (const p of sampleProducts) {
    count++;
    const fineness = p.purity / 24;
    const netWeight = p.grossWeight - (p.stoneWeight || 0);
    const fineGoldWeight = netWeight * fineness;
    const rate = 7400;
    const metalValue = netWeight * rate;
    const purchaseCost = Math.round(metalValue + p.makingCharge);
    const sellingPrice = Math.round(purchaseCost * 1.15);

    await prisma.product.create({
      data: {
        itemCode: `${(p.metal || 'GOLD').substring(0, 2).toUpperCase()}${String(count).padStart(5, '0')}`,
        name: p.name,
        categoryId: count % 3 === 1 ? 1 : count % 3 === 2 ? 2 : 6,
        metal: p.metal,
        purity: p.purity,
        fineness,
        grossWeight: p.grossWeight,
        stoneWeight: p.stoneWeight || 0,
        otherMaterialWeight: 0,
        netWeight,
        fineGoldWeight,
        stoneType: p.stoneType || null,
        hallmark: true,
        purchaseCost,
        sellingPrice,
        makingCharge: p.makingCharge,
        wastage: metalValue * (p.wastagePercent / 100),
        wastagePercent: p.wastagePercent,
        stoneCharge: p.stoneCharge || 0,
        otherCharge: 0,
        discount: 0,
        taxRate: 3,
        supplierId: createdSuppliers[p.supplierIdx].id,
        purchaseDate: new Date(),
        status: 'IN_STOCK',
      },
    });
  }

  const artisans = [
    { name: 'Ganesh Goldsmith', phone: '9876543500', specialty: 'Rings and Pendants' },
    { name: 'Vikram Jeweller', phone: '9876543501', specialty: 'Necklaces and Bangles' },
  ];

  for (const a of artisans) {
    await prisma.artisan.create({ data: a });
  }

  await prisma.settings.upsert({ where: { key: 'shopName' }, update: {}, create: { key: 'shopName', value: 'Royal Jewellers' } });
  await prisma.settings.upsert({ where: { key: 'shopAddress' }, update: {}, create: { key: 'shopAddress', value: '123 Jewellery Lane, Mumbai, Maharashtra - 400001' } });
  await prisma.settings.upsert({ where: { key: 'shopPhone' }, update: {}, create: { key: 'shopPhone', value: '+91 22 1234 5678' } });
  await prisma.settings.upsert({ where: { key: 'shopGST' }, update: {}, create: { key: 'shopGST', value: '27AABCU9603R1ZM' } });
  await prisma.settings.upsert({ where: { key: 'shopLogo' }, update: {}, create: { key: 'shopLogo', value: '' } });
  await prisma.settings.upsert({ where: { key: 'defaultTaxRate' }, update: {}, create: { key: 'defaultTaxRate', value: '3' } });
  await prisma.settings.upsert({ where: { key: 'currency' }, update: {}, create: { key: 'currency', value: 'INR' } });
  await prisma.settings.upsert({ where: { key: 'currencySymbol' }, update: {}, create: { key: 'currencySymbol', value: '₹' } });
  await prisma.settings.upsert({ where: { key: 'sessionTimeout' }, update: {}, create: { key: 'sessionTimeout', value: '480' } });
  await prisma.settings.upsert({ where: { key: 'defaultPurity' }, update: {}, create: { key: 'defaultPurity', value: '22' } });

  const accounts = [
    { name: 'Cash', type: 'CASH' },
    { name: 'HDFC Bank', type: 'BANK' },
    { name: 'UPI', type: 'UPI' },
  ];

  for (const a of accounts) {
    await prisma.account.upsert({ where: { name: a.name }, update: {}, create: a });
  }

  console.log('Seed complete!');
  console.log('');
  console.log('Login credentials:');
  console.log('  Owner:   admin@jewellery.com  / admin123');
  console.log('  Manager: manager@jewellery.com / manager123');
  console.log('  Staff:   staff@jewellery.com  / staff123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });