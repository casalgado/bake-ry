# SystemSettings Implementation - Frontend Guide

## 🎯 What We Built
A centralized system settings collection that allows system administrators to manage global configuration values used across all bakeries.

## 📊 API Endpoints
**Base URL**: `/system-settings` (NOT under `/bakeries/`)

**Authentication**: 
- GET: All authenticated users
- PATCH/PUT: `system_admin` role only

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/system-settings` | Get current system settings |
| `PATCH` | `/system-settings` | Update specific fields |
| `PUT` | `/system-settings` | Replace entire settings |

**No CREATE or DELETE** - settings are auto-initialized via seeding.

## 🔧 Available Configuration Fields

```json
{
  "id": "default",
  "orderStatuses": ["Recibida", "En Produccion", "Preparada", "En Camino", "Completada"],
  "fulfillmentTypes": ["delivery", "pickup"],
  "paymentMethods": ["transfer", "cash", "card"],
  "unitOptions": ["kg", "g", "L", "ml", "unidades", "docena", "paquete"],
  "storageTemperatures": ["Ambiente", "Refrigeracion", "Congelacion"],
  "availablePaymentMethods": [
    { "value": "cash", "label": "Efectivo", "displayText": "E" },
    { "value": "transfer", "label": "Transferencia", "displayText": "T" },
    { "value": "card", "label": "Tarjeta", "displayText": "DF" },
    { "value": "davivienda", "label": "Davivienda", "displayText": "D" },
    { "value": "bancolombia", "label": "Bancolombia", "displayText": "B" },
    { "value": "complimentary", "label": "Regalo", "displayText": "R" }
  ],
  "createdAt": "2025-08-15T19:44:03.375Z",
  "updatedAt": "2025-08-15T19:44:03.375Z"
}
```

## 🔒 Security Requirements
- **Authentication**: Valid Firebase JWT token required for all operations
- **Authorization**: 
  - **GET**: All authenticated users can read system settings
  - **PATCH/PUT**: Only users with `role: "system_admin"` can modify settings
- **Immutable Fields**: `id` and `createdAt` cannot be modified
- **Validation**: All array fields must be arrays, empty requests rejected

## 🎨 Frontend Implementation Notes

### 1. Access Control
```typescript
// All authenticated users can view system settings
const canViewSettings = !!user; // Any authenticated user

// Only system admins can modify settings
const canModifySettings = user?.role === 'system_admin';

// Show/hide UI elements accordingly
<SystemSettingsView 
  readonly={!canModifySettings}
  showEditControls={canModifySettings}
/>
```

### 2. API Usage Examples
```typescript
// Get current settings
const settings = await fetch('/system-settings', {
  headers: { Authorization: `Bearer ${token}` }
});

// Update specific field (PATCH)
await fetch('/system-settings', {
  method: 'PATCH',
  headers: { 
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}` 
  },
  body: JSON.stringify({
    orderStatuses: ["New", "Processing", "Complete"]
  })
});

// Replace entire settings (PUT)
await fetch('/system-settings', {
  method: 'PUT',
  headers: { 
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}` 
  },
  body: JSON.stringify({
    orderStatuses: ["Recibida", "En Produccion", "Completada"],
    fulfillmentTypes: ["delivery", "pickup"],
    // ... include all fields
  })
});
```

### 3. Form Validation
- All settings fields are arrays
- Validate array types before sending
- Handle validation errors from API responses

### 4. Error Handling
```typescript
try {
  const response = await fetch('/system-settings', { method: 'PATCH', ... });
  if (!response.ok) {
    const error = await response.json();
    // Handle specific errors:
    // - "System admin access required" (403) - Only for PATCH/PUT
    // - "No token provided" (401) - For any operation without auth
    // - "orderStatuses must be an array" (400) - Validation errors
    // - "Cannot update immutable field: id" (400) - Immutable field errors
  }
} catch (error) {
  // Handle network errors
}
```

## 🔄 Use Cases

### Order Management
Customize order workflow statuses system-wide:
```typescript
// Update order statuses for all bakeries
await updateSystemSettings({
  orderStatuses: ["Recibida", "En Preparacion", "Lista", "Entregada"]
});
```

### Payment Setup
Add/remove payment methods globally:
```typescript
// Add new payment method
const currentSettings = await getSystemSettings();
const newPaymentMethods = [
  ...currentSettings.availablePaymentMethods,
  { value: "nequi", label: "Nequi", displayText: "N" }
];

await updateSystemSettings({
  availablePaymentMethods: newPaymentMethods
});
```

### Product Management
Modify available units and storage temperatures:
```typescript
// Add new unit option
await updateSystemSettings({
  unitOptions: [...currentSettings.unitOptions, "onzas", "libras"]
});
```

### Fulfillment Configuration
Configure delivery/pickup options:
```typescript
// Add new fulfillment type
await updateSystemSettings({
  fulfillmentTypes: ["delivery", "pickup", "curbside"]
});
```

## 🔗 Integration Points
- **BakerySettings**: Individual bakeries inherit these defaults
- **System-wide**: Changes affect all bakeries immediately  
- **Backwards Compatible**: Existing bakery-specific settings unchanged

## 🚀 Implementation Checklist

### Required UI Components
- [ ] System Settings page (system admin only)
- [ ] Array field editors for each setting type
- [ ] Form validation for array types
- [ ] Success/error messaging
- [ ] Confirmation dialogs for changes

### Recommended Features
- [ ] Live preview of changes
- [ ] Bulk operations (import/export settings)
- [ ] Change history/audit log
- [ ] Reset to defaults functionality
- [ ] Field-level help text

### Testing Requirements
- [ ] System admin access control
- [ ] Non-admin user restrictions
- [ ] Form validation
- [ ] API error handling
- [ ] Data persistence

## 🔧 Backend Status
✅ **Production Ready** - All endpoints tested and validated
- Authentication ✅
- Authorization ✅ (GET: all users, PATCH/PUT: system_admin only)
- Data validation ✅
- CRUD operations ✅
- Error handling ✅
- Route registration order ✅ (system settings after bakery routes)

## ⚠️ Implementation Notes
- **Route Order**: SystemSettings routes MUST be registered after bakery routes in Express to prevent routing conflicts
- **Multi-level Access**: GET operations are public to authenticated users, modifications are restricted
- **Backward Compatibility**: Implementation doesn't affect existing bakery settings functionality

The backend is fully implemented and ready for frontend integration.