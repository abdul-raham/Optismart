# OptiSmart Portal — System Updates & Workflow Guide

This document provides a clear explanation of all portal system updates, sales reporting fixes, stock fulfillment rules, and database setup instructions.

---

## 1. Accurate Sales Reporting & Pending Orders Fix

### The Problem
Previously, the portal counted all created orders (including `pending`, `processing`, `dispatched`, etc.) as "Cameras Sold" and "Delivered Revenue". This caused inaccurate sales figures (e.g. showing 139 cameras sold instead of 55 delivered).

### The System Rule
> **Core Rule**: *"Pending orders do NOT count as sold. Only orders with status DELIVERED represent actual sales and revenue."*

### What Changed in Reports
- **Cameras Sold**: Calculated strictly when status is `Delivered`.
- **Delivered Revenue**: Calculated strictly when status is `Delivered`.
- **Pending Orders**: Explicitly tracks active pipeline orders (`pending`, `approved`, `processing`, `dispatched`, `rescheduled`).
- **Total Originated Orders**: Maintained for full audit visibility.
- **Table & Export Transparency**: Updated UI headers and CSV/Excel exports to display:
  - `Delivered Cameras`
  - `Delivered Orders`
  - `Pending Orders`
  - `Total Originated Orders`
  - `Delivered Revenue (₦)`

---

## 2. Automatic Historical Pending Order Fulfillment

### The Problem
Historical pending orders created before multi-branch inventory tracking was introduced could not be marked as delivered without attempting to deduct current shop inventory or requiring manual settings.

### New Automatic Flow
- **No Manual Checkboxes**: Manual toggle checkboxes were removed to prevent human error, confusion across multiple DSAs, and multi-admin race conditions.
- **Automated Inventory Detection**:
  - When an admin clicks **Mark Delivered**, the system automatically checks physical inventory across all branch locations for that product.
  - **If Inventory Exists**: The branch selection menu is shown, and stock is deducted from the chosen store location.
  - **If No Inventory Exists** (e.g., historical orders or un-tracked items): The system automatically detects this and displays:
    > *"No inventory recorded for this product — Order will be marked as Delivered and commissions recorded without deducting stock."*
  - Admin simply clicks **Confirm Delivery**. The system handles the decision automatically with zero manual toggles.

---

## 3. Physical Inventory Count Override Tool

### How to Match Database Stock with Physical Store Shelf Stock
- Navigate to **Admin Portal ➔ Products ➔ Inventory tab**.
- Click **Set Physical Count** next to any product.
- Enter the exact number of units physically sitting on your store shelf (e.g. `15`).
- The system automatically calculates the difference, updates the inventory count, and logs an audit movement note.

---

## 4. Granular Admin Permissions & Admin Profile View

1. **Permission Controls**: Super Admins can toggle individual permission flags on admin users:
   - `Manage Inventory`
   - `Manage Users`
   - `Manage Expenses`
   - `View Reports`
   - `Delete Records`
2. **Admin Profile Cards**:
   - Admin user cards in the Portal now display exact administrative permissions and inventory audit logs executed by that admin.

---

## 5. Database Setup Script to Run in Supabase

Please copy and run the script below in your **Supabase SQL Editor** (safe to re-run anytime):

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_inventory BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_manage_expenses BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_view_reports BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_delete_records BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.inventory_set_physical_count(
  p_product_id UUID,
  p_location_id UUID,
  p_target_quantity INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_qty INTEGER := 0;
  v_diff INTEGER := 0;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required. Current user ID (%) is not marked as admin.', auth.uid();
  END IF;

  IF p_target_quantity < 0 THEN
    RAISE EXCEPTION 'Target physical quantity cannot be negative';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_old_qty
  FROM public.product_inventory
  WHERE product_id = p_product_id AND location_id = p_location_id;

  v_diff := p_target_quantity - v_old_qty;

  INSERT INTO public.product_inventory (product_id, location_id, quantity, updated_at)
  VALUES (p_product_id, p_location_id, p_target_quantity, NOW())
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = p_target_quantity, updated_at = NOW();

  IF v_diff != 0 THEN
    INSERT INTO public.stock_movements(movement_type, product_id, quantity, to_location_id, notes, created_by_auth_id)
    VALUES (
      CASE WHEN v_diff >= 0 THEN 'stock_in' ELSE 'stock_out' END,
      p_product_id,
      ABS(v_diff),
      p_location_id,
      COALESCE(p_notes, 'Physical Stock Count Audit (Set to ' || p_target_quantity || ' units, previous: ' || v_old_qty || ')'),
      auth.uid()
    );
  END IF;

  PERFORM public.refresh_product_stock(p_product_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.inventory_set_physical_count(UUID, UUID, INTEGER, TEXT) TO authenticated;
```
