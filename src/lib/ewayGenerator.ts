import { STATE_CODES } from '../constants/stateCodes';

export const generateEwayJSON = (invoices: any[], businessProfile: any, ewayBills: any[] = [], skipExisting: boolean = true) => {
  const billLists = invoices.map(inv => {
    // Skip if already has an e-way bill number and we are skipping existing
    if (skipExisting && inv.eway_bill_no) return null;

    const ewayData = ewayBills.find(eb => eb.invoice_id === inv.id) || {};
    console.log('Eway data found for invoice:', inv.id, ewayData);
    
    try {
      console.log('Generating Eway JSON for invoice:', inv.id);
      const rawSubtotal = (inv.invoice_items || []).reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price || item.rate) || 0), 0);
      const itemDiscountTotal = (inv.invoice_items || []).reduce((sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price || item.rate) || 0) * ((Number(item.discount) || 0) / 100)), 0);
      const subtotal = rawSubtotal - itemDiscountTotal;
      const invoiceDiscountAmount = Math.max(0, (Number(inv.discount) || 0) - itemDiscountTotal);
      const discountRatio = subtotal > 0 ? (invoiceDiscountAmount / subtotal) : 0;

      // Calculate item list
      const itemList = (inv.invoice_items || []).map((item: any, index: number) => {
        const gstRate = item.products?.gst_rate || item.gst_rate || 0;
        const isInterState = inv.is_inter_state;
        
        const baseAmount = (Number(item.quantity) || 0) * (Number(item.unit_price || item.rate) || 0);
        const itemDiscountAmount = baseAmount * ((Number(item.discount) || 0) / 100);
        const amountAfterItemDiscount = baseAmount - itemDiscountAmount;
        const finalTaxableAmount = Number((amountAfterItemDiscount * (1 - discountRatio)).toFixed(2));
        
        let hsnCode = String(item.products?.hsn_code || item.hsn_code || "0000");
        if (hsnCode === "0" || hsnCode === "null" || hsnCode === "undefined" || !hsnCode) {
          hsnCode = "0000";
        }

        return {
          itemNo: index + 1,
          productName: item.products?.name || item.name || 'Product',
          productDesc: item.products?.description || item.products?.name || item.name || 'Product',
          hsnCode: hsnCode,
          quantity: Number(item.quantity) || 0,
          qtyUnit: item.products?.unit || "NOS",
          taxableAmount: finalTaxableAmount,
          sgstRate: !isInterState ? Number(gstRate) / 2 : 0,
          cgstRate: !isInterState ? Number(gstRate) / 2 : 0,
          igstRate: isInterState ? Number(gstRate) : 0,
          cessRate: Number(item.products?.cess_rate || item.cess_rate) || 0,
          cessNonAdvol: Number(item.products?.cess_amount || item.cess_amount) || 0
        };
      });

      const docDate = new Date(inv.date);
      const formattedDocDate = `${String(docDate.getDate()).padStart(2, '0')}/${String(docDate.getMonth() + 1).padStart(2, '0')}/${docDate.getFullYear()}`;

      // Extract state codes
      const getStateCode = (stateStr: string | undefined, gstin: string | undefined) => {
        if (gstin && gstin.length >= 2) {
          const code = parseInt(gstin.substring(0, 2));
          if (!isNaN(code) && code > 0) return code;
        }
        if (stateStr) {
          const stateEntry = Object.entries(STATE_CODES).find(([code, name]) => 
            name.toLowerCase() === stateStr.toLowerCase() || code === stateStr
          );
          if (stateEntry) return parseInt(stateEntry[0]);
        }
        return 0;
      };

      const fromStateCode = getStateCode(businessProfile?.state, businessProfile?.gst_number);
      const toStateCode = getStateCode(inv.customers?.state || inv.customer_state_code, inv.customers?.gstin);

      const mainHsnCode = itemList.length > 0 ? parseInt(itemList[0].hsnCode) || 0 : 0;
      const calculatedTotalValue = Number(itemList.reduce((sum: number, item: any) => sum + item.taxableAmount, 0).toFixed(2));
      const isInterState = inv.is_inter_state;

      return {
        userGstin: businessProfile?.gst_number || '',
        supplyType: ewayData.supply_type || ewayData.supplyType || 'O',
        subSupplyType: parseInt(ewayData.sub_supply_type || ewayData.subSupplyType) || 1,
        subSupplyDesc: ewayData.sub_supply_desc || ewayData.subSupplyDesc || '',
        docType: "INV",
        docNo: inv.invoice_number ? inv.invoice_number.replace(/^[0/\-]+/, '') || inv.invoice_number : '',
        docDate: formattedDocDate,
        transType: parseInt(ewayData.transaction_type || ewayData.transactionType) || 1,
        fromGstin: businessProfile?.gst_number || '',
        fromTrdName: businessProfile?.name || '',
        fromAddr1: businessProfile?.address1 || '',
        fromAddr2: businessProfile?.address2 || '',
        fromPlace: businessProfile?.city || '',
        fromPincode: parseInt(businessProfile?.pincode) || 0,
        fromStateCode: fromStateCode,
        actualFromStateCode: fromStateCode,
        toGstin: inv.customers?.gstin || 'URP',
        toTrdName: inv.customers?.name || '',
        toAddr1: inv.customers?.address || '',
        toAddr2: ewayData.to_addr2 || ewayData.toAddr2 || '',
        toPlace: inv.customers?.city || '',
        toPincode: parseInt(inv.customers?.pincode) || 0,
        toStateCode: toStateCode,
        actualToStateCode: toStateCode,
        totalValue: calculatedTotalValue,
        cgstValue: !isInterState ? Number(inv.cgst_amount) || 0 : 0,
        sgstValue: !isInterState ? Number(inv.sgst_amount) || 0 : 0,
        igstValue: isInterState ? Number(inv.igst_amount) || 0 : 0,
        cessValue: Number(ewayData.cess_value || ewayData.cessValue) || 0,
        TotNonAdvolVal: Number(ewayData.tot_non_advol_val || ewayData.TotNonAdvolVal) || 0,
        OthValue: Number(ewayData.oth_value || ewayData.OthValue) || 0,
        totInvValue: Number(inv.total) || 0,
        transMode: parseInt(ewayData.trans_mode || ewayData.transMode) || 1,
        transDistance: parseInt(ewayData.trans_distance || ewayData.transDistance) || 0,
        transporterName: ewayData.transporter_name || ewayData.transporterName || '',
        transporterId: ewayData.transporter_id || ewayData.transporterId || '',
        transDocNo: ewayData.trans_doc_no || ewayData.transDocNo || '',
        transDocDate: (ewayData.trans_doc_date || ewayData.transDocDate) ? (() => {
          const d = new Date(ewayData.trans_doc_date || ewayData.transDocDate);
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        })() : '',
        vehicleNo: ewayData.vehicle_no || ewayData.vehicleNo || '',
        vehicleType: ewayData.vehicle_type || ewayData.vehicleType || 'R',
        mainHsnCode: mainHsnCode,
        itemList
      };
    } catch (e) {
      console.error("Failed to parse eway data for invoice", inv.id, e);
      return null;
    }
  }).filter(Boolean);

  return {
    version: "1.0.0621",
    billLists
  };
};
