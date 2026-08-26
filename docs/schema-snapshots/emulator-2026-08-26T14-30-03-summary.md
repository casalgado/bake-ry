# Firestore Schema Snapshot

*Generated (diagnostic — inferred from sampled documents, not hand-maintained).*

- **Generated:** 2026-08-26T14:30:03.203Z
- **Project:** bake-ry (emulator)
- **Sample size:** 10
- **Max depth:** 6
- **Scope:** bakeries

### `/bakeries`
*Docs sampled: 3 of 3 total (exhaustive)*

```
FIXED FIELDS:
  name : string
  ownerId : string
  operatingHours : { monday: { isOpen: boolean, open: string, close: string }, tuesday: { isOpen: boolean, open: string, close: string }, wednesday: { isOpen: boolean, open: string, close: string }, thursday: { isOpen: boolean, open: string, close: string }, friday: { isOpen: boolean, open: string, close: string }, saturday: { isOpen: boolean, open: string, close: string }, sunday: { isOpen: boolean, open: string, close: string } }
  socialMedia : { facebook: string, instagram: string, tiktok: string, youtube: string, twitter: string, pinterest: string }
  createdAt : Timestamp
  updatedAt : Timestamp
  isActive : boolean

```

#### Subcollection: `productCollections` (3 bakeries sampled)

**Merged shape across 15 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  name : string
  description : string
  displayOrder : number
  isActive : boolean
  isDeleted : boolean
  defaultVariationType : null
  defaultUnit : null
  dimensionTemplates : { dimensions: Array<unknown> }
  variationTemplates : Array<unknown>

```

#### Subcollection: `products` (3 bakeries sampled)

**Merged shape across 30 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  bakeryId : string
  name : string
  collectionId : string
  collectionName : string
  variations : { dimensions: Array<{ id: string, type: string, label: string, unit: string, options: Array<{ name: string, value: number, isWholeGrain: boolean, displayOrder: number }>, displayOrder: number }>, combinations: Array<{ id: string, selection: Array<string>, name: string, basePrice: number, currentPrice: number, costPrice: number, costPriceSource: string, recipeId: null, isWholeGrain: boolean, isActive: boolean, accountingCode: string }> }
  hasVariations? : boolean  (present: 20/30)
  costPriceSource : string
  inventoryMode : string
  usedInRecipes : Array<unknown>
  taxPercentage : number
  isActive : boolean
  isDeleted : boolean
  customAttributes : {  }
  basePrice? : number  (present: 16/30)
  currentPrice? : number  (present: 16/30)
  updatedAt? : Timestamp  (present: 2/30)

```

#### Subcollection: `settings` (3 bakeries sampled)

**Merged shape across 3 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  bakeryId : string
  ingredientCategories : Array<{ id: string, name: string, description: string, displayOrder: number, isActive: boolean }>
  suggestedProductVariations : { SIZE?: { label: string, unit: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string }> }, QUANTITY: { label: string, prefix: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string }> }, WEIGHT?: { label: string, unit: string, defaults: Array<{ name: string, value: number, basePrice: number, recipeId: string }> } }
  theme : {  }
  features : { order: { activePaymentMethods: Array<string>, allowPartialPayment: boolean, defaultDate: string, timeOfDay: boolean, offlineMode: boolean, loadHistoricalOnUserSelection: boolean }, reports: { defaultReportFilter: string, showMultipleReports: boolean }, invoicing: { defaultTermsAndConditions: string, showProductDescriptions: boolean, showTermsAndConditions: boolean, taxMode: string }, pos: { enabled: boolean, autoMarkPaid: boolean, defaultToCurrentDate: boolean, hideDeliveryOptions: boolean, autoSelectClient: boolean, defaultClientId: null }, inventory: { enabled: boolean } }
  branding : { logos: { original: string, small: string, medium: string, large: string }, primaryColor: string, secondaryColor: string }
  subscription : { status: string, tier: string, subscriptionStartDate: Timestamp, amount: number, currency: string, savedCardId: null, recurringPaymentId: null, consecutiveFailures: number, createdAt: Timestamp, updatedAt: Timestamp }

```

#### Subcollection: `ingredients` (1 bakeries sampled)

**Merged shape across 10 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  bakeryId : string
  name : string
  categoryId : string
  categoryName : string
  type : string
  recipeId : null
  stockBehavior : string
  notes : string
  costPerUnit : number
  currency : string
  unit : string
  storageTemp : string
  isActive : boolean
  isDiscontinued : boolean
  isDeleted : boolean
  customAttributes : {  }
  updatedAt : Timestamp
  usedInRecipes : Array<string>

```

#### Subcollection: `orders` (1 bakeries sampled)

**Merged shape across 10 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  updatedAt? : Timestamp  (present: 9/10)
  preparationDate : Timestamp
  dueDate : Timestamp
  paymentDate : null | Timestamp
  partialPaymentDate : null
  bakeryId : string
  userId : string
  userName : string
  userEmail : string
  userPhone : string
  userLegalName : string
  userCategory : string
  userNationalId : string
  invoiceGracePeriod : null
  isInvoiceExpired : boolean
  taxMode : string
  orderItems : Array<{ id: string, productId: string, productName: string, productDescription: string, collectionId: string, collectionName: string, quantity: number, basePrice: number, currentPrice: number, costPrice: number, taxPercentage: number, isComplimentary: boolean, productionBatch: number, status: number, taxMode: string, displayOrder: number, referencePrice: number, discountType: null, discountValue: number, combination: null | { id: string, selection: Array<string>, name: string, basePrice: number, currentPrice: number, costPrice: number, costPriceSource: string, recipeId: null, isWholeGrain: boolean, isActive: boolean, accountingCode: string }, variation: null | { id: string, name: string, value: number, unit?: string, isWholeGrain: boolean, currentPrice?: number }, invoiceTitle: string, taxAmount: number, preTaxPrice: number, subtotal: number }>
  dueTime : string
  status : number
  isPaid : boolean
  isDeliveryPaid : boolean
  paymentMethod : string
  partialPayments : Array<unknown>
  partialPaymentAmount : number
  earliestPartialPaymentDate : null
  fulfillmentType : string
  deliveryAddress : string
  deliveryInstructions : string
  deliveryDriverId : string
  driverMarkedAsPaid : boolean
  deliverySequence : number
  deliveryFee : number
  deliveryCost : number
  numberOfBags : number
  isComplimentary : boolean
  isQuote : boolean
  orderDiscountType : null
  orderDiscountValue : number
  preTaxSubtotal : number
  postTaxSubtotal : number
  subtotal : number
  orderDiscountAmount : number
  totalTaxAmount : number
  preTaxTotal : number
  taxBreakdown : Array<unknown>
  total : number
  invoiceCustomizations : { termsAndConditions: string, notes: string, customTitle: string }
  customerNotes : string
  deliveryNotes : string
  internalNotes : string
  isDeleted : boolean
  lastEditedBy : null | { userId: string, email: string, role: string }

```

#### Subcollection: `recipes` (1 bakeries sampled)

**Merged shape across 4 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  updatedAt : Timestamp
  bakeryId : string
  productId : null
  combinationId : null
  ingredientId : null
  yield : null
  name : string
  description : string
  version : number
  ingredients : Array<{ type: string, id: string, combinationId: null, name: string, quantity: number, unit: string, costPerUnit: number, notes: string, ingredientId: string }>
  steps : Array<string>
  preparationTime : number
  bakingTime : number
  isActive : boolean
  isDeleted : boolean
  notes : string

```

#### Subcollection: `users` (1 bakeries sampled)

**Merged shape across 10 sampled docs, all bakeries:**
```
FIXED FIELDS:
  createdAt : Timestamp
  email : string
  role : string
  bakeryId : string
  firstName : string
  lastName : string
  name : string
  legalName : string
  address : string
  birthday : string
  category : string
  comment : string
  phone : string
  nationalId : string
  isActive : boolean
  isDeleted : boolean
  invoiceGracePeriod : null
  id : string
  updatedAt? : Timestamp  (present: 1/10)

```
