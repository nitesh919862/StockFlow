import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Supplier } from '../models/Supplier';
import { Product } from '../models/Product';
import { Sale } from '../models/Sale';
import { SaleItem } from '../models/SaleItem';
import { Purchase } from '../models/Purchase';
import { PurchaseItem } from '../models/PurchaseItem';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { Notification } from '../models/Notification';

export async function ensureSeedData(): Promise<void> {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    return;
  }

  console.log('[StockFlow Seed] Initializing sample development dataset...');

  const [adminHash, managerHash, staffHash] = await Promise.all([
    bcrypt.hash('Admin123!', 10),
    bcrypt.hash('Manager123!', 10),
    bcrypt.hash('Staff123!', 10),
  ]);

  const [admin, manager, staff] = await User.create([
    {
      name: 'Elena Vance',
      email: 'admin@stockflow.io',
      passwordHash: adminHash,
      role: 'Admin',
      department: 'Operations & Finance',
      phone: '+1 (415) 555-0142',
    },
    {
      name: 'Marcus Chen',
      email: 'manager@stockflow.io',
      passwordHash: managerHash,
      role: 'Manager',
      department: 'Warehouse Logistics',
      phone: '+1 (415) 555-0188',
    },
    {
      name: 'Priya Nair',
      email: 'staff@stockflow.io',
      passwordHash: staffHash,
      role: 'Staff',
      department: 'Fulfillment Floor',
      phone: '+1 (415) 555-0194',
    },
  ]);

  const categories = await Category.create([
    {
      name: 'Scanning Hardware',
      slug: 'scanning-hardware',
      description: 'Handheld 1D/2D barcode imagers, cradles, and presentation scanners.',
    },
    {
      name: 'Thermal Printing',
      slug: 'thermal-printing',
      description: 'Direct thermal and thermal transfer desktop shipping label printers.',
    },
    {
      name: 'Weighing Systems',
      slug: 'weighing-systems',
      description: 'Digital stainless steel floor scales, bench scales, and parcel checkweighers.',
    },
    {
      name: 'Warehouse Mobility',
      slug: 'warehouse-mobility',
      description: 'Rugged RFID mobile terminals, vehicle-mount computers, and batteries.',
    },
    {
      name: 'Packaging Supplies',
      slug: 'packaging-supplies',
      description: 'Heavy-duty carton sealers, kraft reinforced tapes, and strapping tools.',
    },
  ]);

  const suppliers = await Supplier.create([
    {
      name: 'David Kowalski',
      companyName: 'Apex AutoID Systems',
      email: 'orders@apexautoid.com',
      phone: '+1 (408) 555-0124',
      address: '1420 Bering Drive, Suite 210',
      city: 'San Jose, CA',
      country: 'USA',
      notes: 'Primary supplier for 2D imagers and rugged handhelds. Net-30 terms.',
    },
    {
      name: 'Hannah Lindqvist',
      companyName: 'Nordic Label & Print Co.',
      email: 'supply@nordiclabel.io',
      phone: '+1 (312) 555-0177',
      address: '880 West Fulton Market',
      city: 'Chicago, IL',
      country: 'USA',
      notes: 'Ships thermal printers and 4x6 label rolls within 48 hours.',
    },
    {
      name: 'Rafael Morales',
      companyName: 'Precision WeighTech',
      email: 'sales@weigh-tech.com',
      phone: '+1 (512) 555-0153',
      address: '3901 East Cesar Chavez St',
      city: 'Austin, TX',
      country: 'USA',
      notes: 'NTEP certified floor and shipping scales with calibration certificates.',
    },
    {
      name: 'Claire Beaumont',
      companyName: 'Harborline Packaging',
      email: 'fulfillment@harborlinepkg.com',
      phone: '+1 (206) 555-0169',
      address: '2150 Airport Way South',
      city: 'Seattle, WA',
      country: 'USA',
      notes: 'Bulk carton dispensers, kraft tapes, and protective void fill.',
    },
  ]);

  const products = await Product.create([
    {
      name: 'ScanPro BT-2D Wireless Barcode Scanner',
      sku: 'SF-SCN-201',
      barcode: '8901425002014',
      category: categories[0]._id,
      supplier: suppliers[0]._id,
      purchasePrice: 84,
      sellingPrice: 149,
      currentStock: 46,
      minStockLevel: 15,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 34 },
        { location: 'East Hub', quantity: 12 },
      ],
      description: 'Long-range Bluetooth 5.0 2D omnidirectional handheld imager with charging cradle.',
      imageUrl: '/src/assets/images/product_barcode_scanner_1795188877782.jpg',
    },
    {
      name: 'LabelPro 400 Thermal Shipping Printer',
      sku: 'SF-PRT-400',
      barcode: '8901425004001',
      category: categories[1]._id,
      supplier: suppliers[1]._id,
      purchasePrice: 135,
      sellingPrice: 229,
      currentStock: 8,
      minStockLevel: 12,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 5 },
        { location: 'East Hub', quantity: 3 },
      ],
      description: '300 DPI direct thermal desktop printer for 4x6 carrier labels and warehouse barcodes.',
      imageUrl: '/src/assets/images/product_thermal_printer_1795188877635.jpg',
    },
    {
      name: 'IntelliScale 500lb Stainless Floor Scale',
      sku: 'SF-WGH-500',
      barcode: '8901425005008',
      category: categories[2]._id,
      supplier: suppliers[2]._id,
      purchasePrice: 260,
      sellingPrice: 445,
      currentStock: 19,
      minStockLevel: 6,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 14 },
        { location: 'West Dock', quantity: 5 },
      ],
      description: '304 stainless steel deck floor scale with backlit LED indicator and RS-232 output.',
      imageUrl: '/src/assets/images/product_pallet_scale_1795188878453.jpg',
    },
    {
      name: 'RuggedTech RT-4501 Mobile RFID Terminal',
      sku: 'SF-MOB-4501',
      barcode: '8901425045011',
      category: categories[3]._id,
      supplier: suppliers[0]._id,
      purchasePrice: 420,
      sellingPrice: 699,
      currentStock: 5,
      minStockLevel: 10,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 5 },
      ],
      description: 'IP67 rugged handheld warehouse computer with physical keypad and UHF RFID reader.',
      imageUrl: '/src/assets/images/product_rfid_terminal_1795188879490.jpg',
    },
    {
      name: 'Wrecker Steel Carton Tape Dispenser',
      sku: 'SF-PKG-110',
      barcode: '8901425001109',
      category: categories[4]._id,
      supplier: suppliers[3]._id,
      purchasePrice: 18,
      sellingPrice: 36,
      currentStock: 82,
      minStockLevel: 25,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 52 },
        { location: 'East Hub', quantity: 20 },
        { location: 'West Dock', quantity: 10 },
      ],
      description: 'Brushed steel 2-inch heavy-duty packing tape gun with adjustable tension brake.',
      imageUrl: '/src/assets/images/product_tape_dispenser_1795188878108.jpg',
    },
    {
      name: 'Direct Thermal 4x6 Fanfold Labels (2000ct)',
      sku: 'SF-LBL-406',
      barcode: '8901425004063',
      category: categories[1]._id,
      supplier: suppliers[1]._id,
      purchasePrice: 22,
      sellingPrice: 44,
      currentStock: 6,
      minStockLevel: 20,
      location: 'East Hub',
      locationStocks: [
        { location: 'East Hub', quantity: 6 },
      ],
      description: 'Perforated smudge-proof thermal shipping labels compatible with Zebra and LabelPro.',
      imageUrl: '/src/assets/images/product_thermal_printer_1795188877635.jpg',
    },
    {
      name: 'USB-C Presentation Counter Scanner',
      sku: 'SF-SCN-108',
      barcode: '8901425001086',
      category: categories[0]._id,
      supplier: suppliers[0]._id,
      purchasePrice: 58,
      sellingPrice: 109,
      currentStock: 31,
      minStockLevel: 10,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 21 },
        { location: 'West Dock', quantity: 10 },
      ],
      description: 'Hands-free counter scanner engineered for high-throughput retail and packing stations.',
      imageUrl: '/src/assets/images/product_barcode_scanner_1795188877782.jpg',
    },
    {
      name: 'Kraft Reinforced Carton Tape (24-Pack)',
      sku: 'SF-PKG-240',
      barcode: '8901425002403',
      category: categories[4]._id,
      supplier: suppliers[3]._id,
      purchasePrice: 42,
      sellingPrice: 78,
      currentStock: 0,
      minStockLevel: 15,
      location: 'Main Warehouse',
      locationStocks: [
        { location: 'Main Warehouse', quantity: 0 },
      ],
      description: 'Fiberglass-reinforced water-activated kraft sealing tape for heavy outbound cartons.',
      imageUrl: '/src/assets/images/product_tape_dispenser_1795188878108.jpg',
    },
  ]);

  // Helper to create historical dates across the last 6 months
  const monthsAgo = (m: number, day = 14) => {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    d.setDate(day);
    d.setHours(11, 30, 0, 0);
    return d;
  };

  // Seed historical Purchases across 6 months
  const purchaseSeeds = [
    {
      poNumber: 'PO-2026-1001',
      supplier: suppliers[0]._id,
      status: 'Received' as const,
      date: monthsAgo(5, 8),
      items: [
        { product: products[0], qty: 40, cost: 84 },
        { product: products[6], qty: 25, cost: 58 },
      ],
      shipping: 45,
      notes: 'Q2 initial scanner restock',
    },
    {
      poNumber: 'PO-2026-1002',
      supplier: suppliers[1]._id,
      status: 'Received' as const,
      date: monthsAgo(4, 12),
      items: [
        { product: products[1], qty: 18, cost: 135 },
        { product: products[5], qty: 50, cost: 22 },
      ],
      shipping: 35,
      notes: 'Thermal printers and label stock',
    },
    {
      poNumber: 'PO-2026-1003',
      supplier: suppliers[2]._id,
      status: 'Received' as const,
      date: monthsAgo(3, 19),
      items: [{ product: products[2], qty: 15, cost: 260 }],
      shipping: 120,
      notes: 'Palletized floor scales for West Dock',
    },
    {
      poNumber: 'PO-2026-1004',
      supplier: suppliers[0]._id,
      status: 'Received' as const,
      date: monthsAgo(2, 10),
      items: [{ product: products[3], qty: 12, cost: 420 }],
      shipping: 40,
      notes: 'RFID handheld replenishment',
    },
    {
      poNumber: 'PO-2026-1005',
      supplier: suppliers[3]._id,
      status: 'Received' as const,
      date: monthsAgo(1, 15),
      items: [{ product: products[4], qty: 60, cost: 18 }],
      shipping: 28,
      notes: 'Packaging tools batch',
    },
    {
      poNumber: 'PO-2026-1006',
      supplier: suppliers[3]._id,
      status: 'Pending' as const,
      date: monthsAgo(0, 3),
      items: [
        { product: products[7], qty: 30, cost: 42 },
        { product: products[5], qty: 40, cost: 22 },
      ],
      shipping: 35,
      notes: 'Urgent replenishment for out-of-stock kraft tape and low-stock labels',
    },
  ];

  for (const pSeed of purchaseSeeds) {
    const subtotal = pSeed.items.reduce((acc, it) => acc + it.qty * it.cost, 0);
    const po = await Purchase.create({
      poNumber: pSeed.poNumber,
      supplier: pSeed.supplier,
      subtotal,
      shippingCost: pSeed.shipping,
      totalAmount: subtotal + pSeed.shipping,
      status: pSeed.status,
      expectedDate: new Date(pSeed.date.getTime() + 5 * 86400000),
      receivedDate: pSeed.status === 'Received' ? new Date(pSeed.date.getTime() + 3 * 86400000) : undefined,
      notes: pSeed.notes,
      createdBy: manager._id,
      receivedBy: pSeed.status === 'Received' ? manager._id : undefined,
      purchaseDate: pSeed.date,
    });

    const poItems = await PurchaseItem.create(
      pSeed.items.map((it) => ({
        purchase: po._id,
        product: it.product._id,
        productName: it.product.name,
        sku: it.product.sku,
        quantity: it.qty,
        unitCost: it.cost,
        lineTotal: it.qty * it.cost,
      }))
    );

    po.items = poItems.map((i) => i._id);
    await po.save();

    if (pSeed.status === 'Received') {
      for (const it of pSeed.items) {
        await InventoryTransaction.create({
          product: it.product._id,
          type: 'PURCHASE',
          quantity: it.qty,
          previousStock: Math.max(0, it.product.currentStock - it.qty),
          newStock: it.product.currentStock,
          toLocation: it.product.location,
          referenceType: 'Purchase',
          referenceId: po._id,
          referenceCode: po.poNumber,
          reason: `Received ${po.poNumber}`,
          performedBy: manager._id,
          transactionDate: pSeed.date,
        });
      }
    }
  }

  // Seed historical Sales across 6 months
  const saleSeeds = [
    {
      invoiceNumber: 'INV-2026-401',
      customerName: 'Pacific Freight Logistics',
      customerEmail: 'procurement@pacificfreight.com',
      customerPhone: '+1 (503) 555-0118',
      date: monthsAgo(5, 20),
      discount: 0,
      paymentStatus: 'Paid' as const,
      paymentMethod: 'Bank Transfer' as const,
      items: [
        { product: products[0], qty: 12 },
        { product: products[1], qty: 5 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-402',
      customerName: 'Cascade Retail Group',
      customerEmail: 'ops@cascaderetail.com',
      customerPhone: '+1 (206) 555-0192',
      date: monthsAgo(4, 18),
      discount: 120,
      paymentStatus: 'Paid' as const,
      paymentMethod: 'Card' as const,
      items: [
        { product: products[6], qty: 14 },
        { product: products[4], qty: 20 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-403',
      customerName: 'Summit Cold Storage LLC',
      customerEmail: 'buying@summitcold.com',
      customerPhone: '+1 (303) 555-0134',
      date: monthsAgo(3, 24),
      discount: 0,
      paymentStatus: 'Paid' as const,
      paymentMethod: 'Invoice' as const,
      items: [
        { product: products[2], qty: 6 },
        { product: products[3], qty: 4 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-404',
      customerName: 'Vanguard Distribution Co.',
      customerEmail: 'ap@vanguarddist.com',
      customerPhone: '+1 (602) 555-0147',
      date: monthsAgo(2, 22),
      discount: 150,
      paymentStatus: 'Paid' as const,
      paymentMethod: 'Bank Transfer' as const,
      items: [
        { product: products[0], qty: 16 },
        { product: products[1], qty: 8 },
        { product: products[5], qty: 15 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-405',
      customerName: 'Redwood Fulfillments',
      customerEmail: 'warehouse@redwoodfulfill.io',
      customerPhone: '+1 (510) 555-0175',
      date: monthsAgo(1, 21),
      discount: 75,
      paymentStatus: 'Paid' as const,
      paymentMethod: 'Card' as const,
      items: [
        { product: products[3], qty: 5 },
        { product: products[2], qty: 4 },
      ],
    },
    {
      invoiceNumber: 'INV-2026-406',
      customerName: 'BlueRidge Apparel Wholesale',
      customerEmail: 'orders@blueridgeapparel.com',
      customerPhone: '+1 (704) 555-0161',
      date: monthsAgo(0, 6),
      discount: 50,
      paymentStatus: 'Pending' as const,
      paymentMethod: 'Invoice' as const,
      items: [
        { product: products[0], qty: 8 },
        { product: products[4], qty: 15 },
        { product: products[6], qty: 6 },
      ],
    },
  ];

  for (const sSeed of saleSeeds) {
    const subtotal = sSeed.items.reduce((acc, it) => acc + it.qty * it.product.sellingPrice, 0);
    const totalAmount = Math.max(0, subtotal - sSeed.discount);

    const sale = await Sale.create({
      invoiceNumber: sSeed.invoiceNumber,
      customerName: sSeed.customerName,
      customerEmail: sSeed.customerEmail,
      customerPhone: sSeed.customerPhone,
      subtotal,
      discountType: 'fixed',
      discountValue: sSeed.discount,
      discountAmount: sSeed.discount,
      taxAmount: 0,
      totalAmount,
      paymentStatus: sSeed.paymentStatus,
      paymentMethod: sSeed.paymentMethod,
      createdBy: staff._id,
      saleDate: sSeed.date,
    });

    const saleItems = await SaleItem.create(
      sSeed.items.map((it) => ({
        sale: sale._id,
        product: it.product._id,
        productName: it.product.name,
        sku: it.product.sku,
        quantity: it.qty,
        unitPrice: it.product.sellingPrice,
        purchasePriceAtSale: it.product.purchasePrice,
        lineTotal: it.qty * it.product.sellingPrice,
      }))
    );

    sale.items = saleItems.map((i) => i._id);
    await sale.save();

    for (const it of sSeed.items) {
      await InventoryTransaction.create({
        product: it.product._id,
        type: 'SALE',
        quantity: it.qty,
        previousStock: it.product.currentStock + it.qty,
        newStock: it.product.currentStock,
        fromLocation: it.product.location,
        referenceType: 'Sale',
        referenceId: sale._id,
        referenceCode: sale.invoiceNumber,
        reason: `Fulfilled ${sale.invoiceNumber}`,
        performedBy: staff._id,
        transactionDate: sSeed.date,
      });
    }
  }

  // Seed recent manual stock transfer & adjustment for rich activity feed
  await InventoryTransaction.create([
    {
      product: products[0]._id,
      type: 'TRANSFER',
      quantity: 12,
      previousStock: 46,
      newStock: 46,
      fromLocation: 'Main Warehouse',
      toLocation: 'East Hub',
      referenceType: 'Manual',
      reason: 'Regional hub balancing ahead of Q4 peak',
      performedBy: manager._id,
      transactionDate: monthsAgo(0, 12),
    },
    {
      product: products[4]._id,
      type: 'ADJUSTMENT',
      quantity: 2,
      previousStock: 80,
      newStock: 82,
      toLocation: 'Main Warehouse',
      referenceType: 'Manual',
      reason: 'Cycle count reconciliation (Bin A-14)',
      performedBy: admin._id,
      transactionDate: monthsAgo(0, 14),
    },
  ]);

  // Seed initial notifications for low/out-of-stock products
  await Notification.create([
    {
      title: 'Out of Stock Alert',
      message: 'Kraft Reinforced Carton Tape (24-Pack) [SF-PKG-240] has reached 0 units.',
      type: 'OUT_OF_STOCK',
      severity: 'critical',
      product: products[7]._id,
      isRead: false,
    },
    {
      title: 'Low Stock Warning',
      message: 'RuggedTech RT-4501 Mobile RFID Terminal [SF-MOB-4501] is at 5 units (min: 10).',
      type: 'LOW_STOCK',
      severity: 'warning',
      product: products[3]._id,
      isRead: false,
    },
    {
      title: 'Low Stock Warning',
      message: 'LabelPro 400 Thermal Shipping Printer [SF-PRT-400] is at 8 units (min: 12).',
      type: 'LOW_STOCK',
      severity: 'warning',
      product: products[1]._id,
      isRead: false,
    },
    {
      title: 'Low Stock Warning',
      message: 'Direct Thermal 4x6 Fanfold Labels (2000ct) [SF-LBL-406] is at 6 units (min: 20).',
      type: 'LOW_STOCK',
      severity: 'warning',
      product: products[5]._id,
      isRead: false,
    },
  ]);

  console.log('[StockFlow Seed] Seeded users, categories, suppliers, products, sales, purchases & ledger.');
}
