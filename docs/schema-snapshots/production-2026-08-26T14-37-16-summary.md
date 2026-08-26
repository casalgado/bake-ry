# Firestore Schema Snapshot

*Generated (diagnostic — inferred from sampled documents, not hand-maintained).*

- **Generated:** 2026-08-26T14:37:17.096Z
- **Project:** bake-ry (prod)
- **Sample size:** 10
- **Max depth:** 6
- **Scope:** root

### `/bakeries`
*Docs sampled: 10 of 14 total — pinned bakeries + most recent*

```
FIXED FIELDS:
  createdAt : Timestamp
  name : string
  operatingHours : { monday?: { isOpen: boolean, open: string, close: string }, tuesday?: { isOpen: boolean, open: string, close: string }, wednesday?: { isOpen: boolean, open: string, close: string }, thursday?: { isOpen: boolean, open: string, close: string }, friday?: { isOpen: boolean, open: string, close: string }, saturday?: { isOpen: boolean, open: string, close: string }, sunday?: { isOpen: boolean, open: string, close: string } }
  holidays? : Array<unknown>  (present: 8/10)
  ownerId : string
  socialMedia : { instagram?: string, whatsapp?: string, facebook?: string, tiktok?: string, youtube?: string, twitter?: string, pinterest?: string }
  isActive : boolean
  isPaused? : boolean  (present: 8/10)
  customAttributes? : {  }  (present: 8/10)
  legalName? : string  (present: 5/10)
  address? : string  (present: 7/10)
  phone? : string  (present: 5/10)
  email? : string  (present: 5/10)
  nationalId? : string  (present: 5/10)
  updatedAt : Timestamp

```

#### Subcollection: `orders` (8 bakeries sampled)

**Merged shape across 63 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  preparationDate : Timestamp
  dueDate : Timestamp
  partialPaymentDate : null | string
  bakeryId : string
  userId : string
  userName : string
  userEmail : string
  userPhone : string
  userLegalName? : string  (present: 62/63)
  userCategory? : string  (present: 62/63)
  userNationalId : string
  invoiceGracePeriod? : null | number  (present: 51/63)
  isInvoiceExpired? : boolean  (present: 51/63)
  taxMode? : string  (present: 62/63)
  dueTime : string
  status : number
  isPaid : boolean
  isDeliveryPaid : boolean
  partialPayments? : Array<unknown>  (present: 51/63)
  partialPaymentAmount : number | null
  earliestPartialPaymentDate? : null  (present: 50/63)
  deliveryAddress : string
  deliveryInstructions : string
  deliveryDriverId : string
  driverMarkedAsPaid : boolean
  deliverySequence : number
  deliveryFee : number
  deliveryCost : number
  numberOfBags : number
  isComplimentary : boolean
  isQuote? : boolean  (present: 62/63)
  orderDiscountType? : string  (present: 53/63)
  orderDiscountValue? : number  (present: 53/63)
  orderDiscountAmount? : number  (present: 53/63)
  invoiceCustomizations? : { termsAndConditions: string, notes: string, customTitle: string, subtitles?: Array<{ id: string, text: string, beforeItemId: string }> }  (present: 62/63)
  customerNotes : string
  deliveryNotes : string
  internalNotes : string
  isDeleted : boolean
  lastEditedBy : null | { userId: string, email: string, role: string }
  fulfillmentType : string
  paymentMethod : string
  paymentDate : string | null | Timestamp
  total : number
  subtotal : number
  preTaxTotal : number
  preTaxSubtotal? : number  (present: 53/63)
  taxBreakdown? : Array<{ taxPercentage: number, quantity: number, baseAmount: number, taxAmount: number }>  (present: 53/63)
  totalTaxAmount : number
  postTaxSubtotal? : number  (present: 53/63)
  orderItems : Array<{ id: string, productId: string, productName: string, productDescription?: string, collectionId: string, collectionName: string, quantity: number, basePrice: number, currentPrice: number, costPrice?: number, taxPercentage: number, isComplimentary: boolean, productionBatch: number, status: number, taxMode?: string, displayOrder?: number, referencePrice?: number, discountType?: null | string, discountValue?: number, variation: null | { unit: string, id: string, isWholeGrain: boolean, name: string, value: number }, combination?: null | { id: string, selection: Array<string>, name: string, basePrice: number, currentPrice: number, costPrice: number, costPriceSource?: string, recipeId?: null, isWholeGrain: boolean, isActive: boolean, accountingCode: string }, invoiceTitle?: string, taxAmount: number, preTaxPrice: number, subtotal: number }>
  updatedAt? : Timestamp  (present: 24/63)
  taxableSubtotal? : number  (present: 10/63)
  nonTaxableSubtotal? : number  (present: 10/63)

```

#### Subcollection: `productCollections` (9 bakeries sampled)

**Merged shape across 49 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  name : string
  description? : string  (present: 28/49)
  displayOrder? : number  (present: 28/49)
  isActive : boolean
  isDeleted : boolean
  defaultVariationType? : string  (present: 28/49)
  defaultUnit? : string  (present: 28/49)
  dimensionTemplates? : { dimensions: Array<{ id: string, type: string, label: string, unit: string, options: Array<{ name: string, value: number, displayOrder: number, isWholeGrain: boolean }>, displayOrder: number }> }  (present: 25/49)
  variationTemplates? : Array<{ id: string, name: string, value: number, isWholeGrain: boolean, unit: string, type: string, displayOrder: number }>  (present: 28/49)
  updatedAt? : Timestamp  (present: 13/49)

```

#### Subcollection: `products` (9 bakeries sampled)

**Merged shape across 70 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  bakeryId : string
  name : string
  collectionId : string
  collectionName : string
  description? : string  (present: 62/70)
  accountingCode? : string  (present: 46/70)
  variations : Array<{ id: string, name: string, value: number, basePrice: number, isWholeGrain: boolean, unit?: string, type?: string, displayOrder?: number, currentPrice?: number }> | { dimensions: Array<{ id: string, type: string, label: string, unit: string, options: Array<{ name: string, value: number, displayOrder: number, isWholeGrain: boolean }>, displayOrder: number }>, combinations: Array<{ id: string, selection: Array<string>, name: string, basePrice: number, currentPrice: number, costPrice: number, isWholeGrain: boolean, isActive: boolean, accountingCode?: string }> }
  hasVariations? : boolean  (present: 62/70)
  basePrice? : number  (present: 68/70)
  costPrice? : number  (present: 47/70)
  currentPrice? : number  (present: 68/70)
  taxPercentage : number
  customAttributes : {  }
  isDeleted : boolean
  isActive : boolean
  updatedAt? : Timestamp  (present: 25/70)
  costPriceSource? : string  (present: 2/70)
  inventoryMode? : string  (present: 2/70)
  usedInRecipes? : Array<unknown>  (present: 2/70)

```

#### Subcollection: `settings` (10 bakeries sampled)

**Merged shape across 10 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  bakeryId : string
  ingredientCategories : Array<{ id: string, name: string, description: string, displayOrder: number, isActive: boolean }>
  suggestedProductVariations : { SIZE?: { label: string, unit: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string }> }, QUANTITY?: { label: string, prefix: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string }> }, WEIGHT?: { label: string, unit: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string }> } }
  theme : {  }
  subscription : { status: string, tier: string, subscriptionStartDate: Timestamp, amount: number, currency: string, savedCardId: null, recurringPaymentId: null, consecutiveFailures: number, createdAt: Timestamp, updatedAt: Timestamp }
  branding? : { logos: { original: string, small: string, medium: string, large: string }, primaryColor: string, secondaryColor: string }  (present: 9/10)
  features : { order: { activePaymentMethods: Array<string>, allowPartialPayment: boolean, defaultDate: string, timeOfDay: boolean, offlineMode?: boolean, loadHistoricalOnUserSelection?: boolean }, reports?: { defaultReportFilter: string, showMultipleReports: boolean }, invoicing?: { defaultTermsAndConditions: string, showProductDescriptions: boolean, showTermsAndConditions: boolean, taxMode: string }, pos?: { enabled: boolean, autoMarkPaid: boolean, defaultToCurrentDate: boolean, hideDeliveryOptions: boolean, autoSelectClient: boolean, defaultClientId: null | string }, products?: { useProductCost?: boolean }, inventory?: { enabled: boolean }, accounting?: { enabled: boolean } }
  updatedAt? : Timestamp  (present: 7/10)
  orderStatuses? : Array<string>  (present: 4/10)
  fulfillmentTypes? : Array<string>  (present: 4/10)
  paymentMethods? : Array<string>  (present: 4/10)
  unitOptions? : Array<string>  (present: 4/10)
  storageTemperatures? : Array<string>  (present: 4/10)

```

#### Subcollection: `updateHistory` (5 bakeries sampled)

**Merged shape across 11 sampled docs, all bakeries:**
```
FIXED FIELDS:
  timestamp : Timestamp
  editor : { userId: string, email: string, role: string }
  changes : { nationalId?: { from: string | null, to: string }, address?: { from: null, to: string }, phone?: { from: null, to: string }, email?: { from: null, to: string }, legalName?: { from: null, to: string } }

```

#### Subcollection: `users` (9 bakeries sampled)

**Merged shape across 67 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  email : string
  role : string
  bakeryId : string
  firstName : string
  lastName : string
  name : string
  legalName? : string  (present: 65/67)
  address : string
  birthday : string
  category : string
  comment : string
  phone : string
  nationalId : string
  isActive : boolean
  isDeleted : boolean
  invoiceGracePeriod? : null  (present: 45/67)
  id : string
  updatedAt? : Timestamp  (present: 2/67)

```

#### Subcollection: `ingredients` (2 bakeries sampled)

**Merged shape across 11 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  name : string
  categoryId : string
  categoryName : string
  type : string
  costPerUnit : number
  currency : string
  currentStock : number
  unit : string
  isActive : boolean
  isDiscontinued : boolean
  isDeleted : boolean
  customAttributes : {  }
  usedInRecipes : Array<string>
  updatedAt : Timestamp
  bakeryId? : string  (present: 10/11)
  notes? : string  (present: 10/11)
  storageTemp? : string  (present: 10/11)

```

#### Subcollection: `recipes` (2 bakeries sampled)

**Merged shape across 5 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  bakeryId : string
  productId? : null  (present: 1/5)
  name : string
  description : string
  version : number
  ingredients : Array<{ ingredientId: string, name: string, quantity: number, unit: string, costPerUnit: number, notes: string }>
  steps : Array<string>
  preparationTime : number
  bakingTime : number
  isActive : boolean
  isDeleted : boolean
  updatedAt? : Timestamp  (present: 4/5)
  notes? : string  (present: 4/5)

```

### `/systemSettings`
*Docs sampled: 1 of 1 total (exhaustive)*

```
FIXED FIELDS:
  createdAt : Timestamp
  updatedAt : Timestamp
  orderStatuses : Array<string>
  fulfillmentTypes : Array<{ key: string, value: string }>
  unitOptions : Array<{ symbol: string, name: string, type: string, template: string }>
  storageTemperatures : Array<{ key: string, value: string }>
  availablePaymentMethods : Array<{ value: string, label: string, displayText: string }>
  defaultVariationTemplates : { WEIGHT: { label: string, unit: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string, id?: string, displayOrder?: number }> }, QUANTITY: { label: string, unit: string, prefix: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string, id?: string, displayOrder?: number }> }, SIZE: { label: string, unit: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string, id?: string, displayOrder?: number }> } }

```

### `/users`
*Docs sampled: 10 of 20 total — NOT exhaustive, raise `--sample` to see more*

```
FIXED FIELDS:
  id : string
  email : string
  name : string
  role : string
  bakeryId : string
  createdAt : Timestamp
  updatedAt : Timestamp

```
