# Product Variations System

## Overview & Architecture

The Product Variations System provides a flexible, multi-tiered approach to managing product variations in the bakery management system. It enables bakeries to create consistent product offerings while maintaining flexibility for custom variations.

### Goals
- **Consistency**: Standardized variation templates across products
- **Flexibility**: Custom variations per collection and product
- **Efficiency**: Reusable templates reduce repetitive setup
- **User Experience**: Intuitive workflow from collection → product → variations

### Architecture
```
SystemSettings (Global)
├── DEFAULT_VARIATION_TEMPLATES
│   ├── WEIGHT (g): mini, pequeño, mediano, grande, extra grande
│   ├── QUANTITY (units): x5, x6, x10, x12, x16
│   └── SIZE (ordinal): mini(1), pequeño(2), mediano(3), grande(4), extra grande(5)
│
ProductCollection (Per Bakery)
├── variationTemplates[] (without pricing)
├── defaultVariationType ('WEIGHT'|'QUANTITY'|'SIZE')
└── getSuggestedVariations() → combines collection + system defaults
│
Product (Per Collection)
├── variations[] (with pricing)
└── Uses ProductVariation instances
│
Order → OrderItem
├── variation (snapshot, plain object)
└── currentPrice (actual price paid)
```

## Core Components

### SystemSettings
**Location**: `src/models/SystemSettings.js`

Global configuration containing default variation templates available to all bakeries.

```javascript
static DEFAULT_VARIATION_TEMPLATES = {
  WEIGHT: {
    label: 'Weight',
    unit: 'g',
    defaults: [
      { name: 'mini', value: 300, basePrice: 12000, recipeId: '' },
      { name: 'pequeño', value: 550, basePrice: 16000, recipeId: '' },
      { name: 'mediano', value: 950, basePrice: 25000, recipeId: '' },
      { name: 'grande', value: 1700, basePrice: 34000, recipeId: '' },
      { name: 'extra grande', value: 2500, basePrice: 45000, recipeId: '' },
    ],
  },
  QUANTITY: {
    label: 'Quantity',
    unit: 'uds',
    prefix: 'x',
    defaults: [
      { name: 'x5', value: 5, basePrice: 9000, recipeId: '' },
      { name: 'x6', value: 6, basePrice: 15000, recipeId: '' },
      { name: 'x10', value: 10, basePrice: 12000, recipeId: '' },
      { name: 'x12', value: 12, basePrice: 18000, recipeId: '' },
      { name: 'x16', value: 16, basePrice: 20000, recipeId: '' },
    ],
  },
  SIZE: {
    label: 'Size',
    unit: '',
    defaults: [
      { name: 'mini', value: 1, basePrice: 12000, recipeId: '' },
      { name: 'pequeño', value: 2, basePrice: 16000, recipeId: '' },
      { name: 'mediano', value: 3, basePrice: 25000, recipeId: '' },
      { name: 'grande', value: 4, basePrice: 34000, recipeId: '' },
      { name: 'extra grande', value: 5, basePrice: 45000, recipeId: '' },
    ],
  },
}
```

### ProductVariation
**Location**: `src/models/ProductVariation.js`

Individual variation model representing a specific size/quantity/type option.

**Properties**:
- `id`: Unique identifier
- `name`: Variation name (stored lowercase)
- `value`: Numeric value (weight in grams, quantity in units, size as ordinal)
- `basePrice`: Catalog price (required for products, optional for collection templates)
- `recipeId`: Associated recipe
- `isWholeGrain`: Boolean flag for grain type
- `unit`: Unit of measurement ('g', 'units', 'size')
- `type`: Variation type ('WEIGHT', 'QUANTITY', 'SIZE')
- `displayOrder`: Sorting order

**Key Methods**:
- `validate()`: Validates required fields and business rules
- `getDisplayValue()`: Formats value for display (e.g., "500g", "x6", "pequeño")
- `fromTemplate()`: Creates variation from system template
- `fromLegacy()`: Backward compatibility for old data

**Important**: ProductVariation only stores `basePrice`. The `currentPrice` (actual price paid) is only stored in OrderItems for historical accuracy.

### ProductCollection
**Location**: `src/models/ProductCollection.js`

Enhanced collection model that can define variation templates for products in the collection.

**New Properties**:
- `variationTemplates[]`: Array of ProductVariation instances (without pricing)
- `defaultVariationType`: Default variation type for this collection
- `description`: Collection description
- `displayOrder`: Display ordering

**Key Methods**:
- `getVariationTemplates()`: Returns plain objects for product creation
- `addVariationTemplate(template)`: Adds new template to collection
- `removeVariationTemplate(templateId)`: Removes template
- `updateVariationTemplate(templateId, updates)`: Updates existing template
- `getSuggestedVariations(systemDefaults)`: Combines collection templates + system defaults

### Product
**Location**: `src/models/Product.js` (updated)

Uses new ProductVariation class with backward compatibility.

**Changes**:
- Imports ProductVariation from separate file
- Maintains backward compatibility for existing data
- Names stored lowercase for consistency

### Order/OrderItem
**Location**: `src/models/Order.js`

Orders store variation data as **immutable snapshots** (plain objects, not ProductVariation instances).

**Why Plain Objects?**:
- Historical preservation - "what was ordered at that moment"
- Decoupled from future ProductVariation model changes
- Performance - no instance overhead in order data

## Data Structures & Storage

### Firestore Storage Locations

```
/systemSettings/default
├── defaultVariationTemplates: {
│   WEIGHT: { label, unit, defaults[] },
│   QUANTITY: { label, unit, prefix, defaults[] },
│   SIZE: { label, unit, defaults[] }
│ }

/bakeries/{bakeryId}/productCollections/{collectionId}
├── name: string (lowercase)
├── description: string
├── defaultVariationType: 'WEIGHT'|'QUANTITY'|'SIZE'|null
├── variationTemplates: [
│   {
│     id: string,
│     name: string (lowercase),
│     value: number,
│     unit: string,
│     type: string,
│     isWholeGrain: boolean,
│     displayOrder: number
│     // NOTE: no basePrice in collection templates
│   }
│ ]

/bakeries/{bakeryId}/products/{productId}
├── name: string (lowercase)
├── collectionId: string
├── variations: [
│   {
│     id: string,
│     name: string (lowercase),
│     value: number,
│     basePrice: number,    // Required for products
│     unit: string,
│     type: string,
│     isWholeGrain: boolean,
│     recipeId: string,
│     displayOrder: number
│   }
│ ]

/bakeries/{bakeryId}/orders/{orderId}
├── orderItems: [
│   {
│     variation: {           // Plain object snapshot
│       id: string,
│       name: string,
│       value: number,
│       // ... other properties as they were when ordered
│     },
│     currentPrice: number   // Actual price paid (may differ from basePrice)
│   }
│ ]
```

### Template vs Instance Concepts

**Templates** (in SystemSettings and ProductCollection):
- Structure and default values only
- No pricing information (optional basePrice in SystemSettings for suggestions)
- Reusable across multiple products
- Define shape and characteristics

**Instances** (in Products):
- Specific variations with pricing
- Based on templates but customizable
- Include basePrice for catalog pricing
- Used for creating orders

**Snapshots** (in Orders):
- Historical record of variation at order time
- Immutable plain objects
- Include currentPrice (actual price paid)
- Preserve data even if templates/products change

## Detailed User Experience Flows

### 4.1 Collection Creation Flow

#### Step 1: Basic Collection Information
```
User fills out:
├── Collection Name (will be stored lowercase)
├── Description (optional)
├── Display Order (for UI sorting)
└── Active Status
```

#### Step 2: Choose Default Variation Type
```
User selects from:
├── WEIGHT - for products sold by weight (breads, pastries)
├── QUANTITY - for products sold in quantities (cookies, rolls)
├── SIZE - for products with size categories (cakes, custom items)
└── None - collection won't suggest variations
```

**Impact**: When users create products in this collection, variations from the selected type will be prominently suggested.

#### Step 3: Customize Collection Variation Templates

**IMPORTANT**: Collections can completely customize their variation templates. They can:

##### **Start from System Defaults (Optional)**
```
User can begin with system defaults for their defaultVariationType:
├── WEIGHT: mini(300g), pequeño(550g), mediano(950g), grande(1700g), extra grande(2500g)
├── QUANTITY: x5, x6, x10, x12, x16
└── SIZE: mini(1), pequeño(2), mediano(3), grande(4), extra grande(5)
```

##### **Full Customization Power**
```
User can completely modify the variation set:
├── ✅ Remove unwanted options (e.g., remove "mini" size)
├── ✅ Add custom options (e.g., "double extra grande" - 3500g)
├── ✅ Modify values (e.g., change "pequeño" from 550g to 600g)
├── ✅ Rename variations (e.g., "pequeño" → "individual size")
├── ✅ Change type entirely (start with WEIGHT, switch to QUANTITY)
└── ✅ Create completely new variation sets
```

##### **For Each Custom Template**
```
User defines:
├── Name (e.g., "family size", "party pack", "sample")
├── Value (numeric: 1200 for weight, 8 for quantity, 6 for custom size)
├── Unit (can modify: 'g', 'kg', 'units', 'dozens', 'size')
├── Type (can change: 'WEIGHT', 'QUANTITY', 'SIZE')
├── Whole Grain Option (checkbox)
└── Display Order (custom sorting)
```

**Key UX Points**:
- **Complete creative control**: Collections can have unique variation sets
- **Templates WITHOUT pricing**: Pricing is set later at product level
- **Collection-specific**: These templates only apply to products in this collection  
- **Persistent storage**: Templates are saved and reused for all products in collection
- **Live preview**: Users can see how templates will appear during product creation

#### Step 4: Template Management
```
User can:
├── Add new templates anytime
├── Edit existing templates
├── Remove unused templates
├── Reorder templates (display order)
└── Preview how templates will appear in product creation
```

### 4.2 Product Creation Flow

#### Step 1: Basic Product Information
```
User fills out:
├── Product Name (will be stored lowercase)
├── Select Collection (required)
├── Base Price (for products without variations)
├── Recipe ID
└── Tax Percentage
```

#### Step 2: Variation Selection Interface

When user reaches variation setup, they see **two sources**:

##### Collection Templates (Primary - First Priority)
```
If collection has custom variation templates:
├── "From your [Collection Name] collection:"
├── Display ALL collection-specific variation templates
├── These are the custom templates created/modified for this collection
├── User can select which ones to include in this product
├── Templates auto-populate with custom values (names, weights, etc.)
├── User can still modify at product level if needed
└── Pricing required for each selected template

Example: "Artisan Breads" collection might have:
├── "mini loaf" - 400g (custom, removed standard 300g "mini")
├── "regular" - 800g (custom, instead of standard 550g "pequeño") 
├── "family size" - 1200g (completely custom addition)
└── "celebration loaf" - 2000g (custom, beyond standard sizes)
```

##### System Defaults (Secondary)
```
"You can also add from system defaults:"
├── Show all 3 types (WEIGHT, QUANTITY, SIZE)
├── Collection's default type is highlighted/pre-expanded
├── User can pick any variations from any type
├── Each selection requires pricing
└── User can mix collection templates + system defaults
```

#### Step 3: Variation Customization
```
For each selected variation, user can customize:
├── Name (defaults from template, editable)
├── Base Price (required, no default)
├── Value (defaults from template, editable)
├── Recipe ID (optional, specific to this variation)
├── Whole Grain option (defaults from template)
└── Display Order (for product-specific ordering)
```

#### Step 4: Bulk Operations
```
User experience enhancements:
├── "Apply price pattern" - set prices with multipliers
├── "Copy from similar product" - import variation set
├── "Quick setup" - use all collection templates with base pricing
└── "Preview variations" - see how they'll display to customers
```

### 4.3 Complete Customization Example

#### **Real-World Scenario**: Artisan Bread Collection

**Step 1: Collection Setup**
```
Collection: "Artisan Breads"
Default Type: WEIGHT
System defaults would be: mini(300g), pequeño(550g), mediano(950g), grande(1700g), extra grande(2500g)

User customizes to:
├── "starter" - 200g (smaller than system mini)
├── "personal" - 450g (between system mini/pequeño) 
├── "sharing" - 1200g (between system mediano/grande)
├── "party loaf" - 2200g (bigger than system extra grande)
```

**Step 2: Product Creation**
```
When creating "sourdough bread" product:

PRIMARY OPTIONS (Collection Templates):
✅ "starter" - 200g → User sets price: $8,000
✅ "personal" - 450g → User sets price: $14,000  
✅ "sharing" - 1200g → User sets price: $22,000
✅ "party loaf" - 2200g → User sets price: $38,000

ALSO AVAILABLE (System Defaults):
○ WEIGHT: mini(300g), pequeño(550g), etc. (if user wants standard sizes)
○ QUANTITY: x5, x6, x10, etc. (if user wants to offer by quantity instead)
○ SIZE: mini(1), pequeño(2), etc. (if user wants ordinal sizes)
```

**Step 3: Product-Level Customization**
```
Even after selecting collection templates, user can:
├── Rename: "starter" → "sample size" for this specific product
├── Adjust value: "personal" 450g → 500g for this product only
├── Add extra: Select "pequeño" from system defaults as well
└── Mix types: Use collection WEIGHT templates + system QUANTITY options
```

**Result**: Each collection can have completely unique variation sets that make sense for their product category, while still having access to system-wide standards.

#### **CRITICAL UX WORKFLOW**: Collection Template Customization → Product Inheritance

**This is the key feature that makes the system powerful:**

```
1. System Defaults (Starting Point)
   WEIGHT: mini(300g), pequeño(550g), mediano(950g), grande(1700g), extra grande(2500g)

2. Collection Customization (Per Collection)
   "Artisan Breads" Collection modifies WEIGHT defaults:
   ├── ❌ Remove "mini" (too small for artisan breads)
   ├── ✏️  Modify "pequeño" 550g → "personal" 450g
   ├── ✏️  Modify "mediano" 950g → "sharing" 1200g  
   ├── ✏️  Modify "grande" 1700g → "family" 1800g
   ├── ❌ Remove "extra grande" 
   ├── ➕ Add "party loaf" 2500g (custom addition)
   └── 📁 SAVED in collection.variationTemplates[]

3. Product Creation (Inherits Collection Templates)
   When creating "sourdough bread":
   ├── 🥇 PRIMARY: Collection templates appear first
   │   ├── "personal" - 450g (collection customized)
   │   ├── "sharing" - 1200g (collection customized)
   │   ├── "family" - 1800g (collection customized)
   │   └── "party loaf" - 2500g (collection custom)
   │
   ├── 🥈 SECONDARY: System defaults still available  
   │   ├── WEIGHT: original mini(300g), pequeño(550g), etc.
   │   ├── QUANTITY: x5, x6, x10, etc.
   │   └── SIZE: mini(1), pequeño(2), etc.
   │
   └── ✏️  PRODUCT-LEVEL: Can still customize each selected variation
```

**Backend Architecture Supporting This:**

✅ **Collection Storage**: `variationTemplates[]` stores custom templates persistently  
✅ **Template Management**: `addVariationTemplate()`, `updateVariationTemplate()`, `removeVariationTemplate()`  
✅ **Product Integration**: `getSuggestedVariations()` provides both collection + system options  
✅ **Flexibility**: Products can use collection templates + system defaults + custom modifications  
✅ **Persistence**: Collection customizations are saved and reused for all products in that collection

### 4.4 Variation Selection & Pricing Strategy

#### Pricing Approach
```
Template (no price) → Product Variation (basePrice) → Order (currentPrice)
```

**Collection Template**: "pequeño" - 500g (no price)
**Product Instance**: "pequeño" - 500g - $16,000 basePrice
**Order Snapshot**: "pequeño" - 500g - $15,000 currentPrice (discount applied)

#### Pricing User Experience
```
For each variation selected:
├── Template provides name, value, characteristics
├── User must set basePrice (catalog price)
├── System can suggest pricing based on:
│   ├── System default basePrice (if available)
│   ├── Other products in same collection
│   ├── Value-based calculations (price per gram/unit)
│   └── Manual entry
└── Pricing validation (no negative, required for active products)
```

### 4.4 Order Creation Process

#### Customer-Facing Flow
```
Customer selects:
├── Product (e.g., "sourdough bread")
├── Available variations display with:
│   ├── Name + formatted value (e.g., "pequeño - 500g")
│   ├── Current price (basePrice + any discounts/markups)
│   ├── Availability status
│   └── Special indicators (whole grain, etc.)
└── Add to cart with selected variation
```

#### Backend Order Processing
```
When order is created:
├── Selected variation data is copied as snapshot
├── Current pricing is calculated and stored
├── Variation becomes immutable part of order history
├── Original product variations remain unchanged
└── Future template/product changes don't affect existing orders
```

## Implementation Details

### Validation Rules

#### ProductVariation Validation
```javascript
validate() {
  // Name required and non-empty
  if (!this.name || this.name.trim() === '') {
    throw new BadRequestError('Variation name is required');
  }
  
  // Value required and positive
  if (this.value === undefined || this.value === null) {
    throw new BadRequestError('Variation value is required');
  }
  
  // BasePrice optional for templates, but if provided must be non-negative
  if (this.basePrice !== undefined && this.basePrice !== null && this.basePrice < 0) {
    throw new BadRequestError('Variation base price cannot be negative');
  }
}
```

#### Collection Template Validation
```javascript
addVariationTemplate(template) {
  // Remove pricing from templates
  const { basePrice, ...templateWithoutPrice } = template;
  
  // Create and validate variation
  const variation = new ProductVariation({
    ...templateWithoutPrice,
    id: template.id || generateId(),
  });
  
  variation.validate(); // Will pass without basePrice requirement
  this.variationTemplates.push(variation);
  return variation;
}
```

### Naming Consistency
All entity names are stored lowercase for consistency:
- Product names: `name.toLowerCase()`
- ProductCollection names: `name.toLowerCase()`
- ProductVariation names: `name.toLowerCase()`

This ensures:
- Consistent database storage
- Case-insensitive searching
- Uniform UI display
- Simplified data management

### Display Methods

#### ProductVariation Display Formatting
```javascript
getDisplayValue() {
  switch (this.type) {
    case 'QUANTITY':
      return `x${this.value}`;           // "x6"
    case 'WEIGHT':
      return `${this.value}${this.unit}`; // "500g"
    case 'SIZE':
      return this.name;                   // "pequeño"
    default:
      return `${this.value}${this.unit ? ` ${this.unit}` : ''}`;
  }
}
```

## System Default Templates

### WEIGHT Templates
For products sold by weight (breads, pastries, bulk items):
```
mini: 300g - $12,000 (suggested)
pequeño: 550g - $16,000 (suggested)
mediano: 950g - $25,000 (suggested)
grande: 1,700g - $34,000 (suggested)
extra grande: 2,500g - $45,000 (suggested)
```

### QUANTITY Templates
For products sold in quantities (cookies, rolls, muffins):
```
x5: 5 units - $9,000 (suggested)
x6: 6 units - $15,000 (suggested)
x10: 10 units - $12,000 (suggested)
x12: 12 units - $18,000 (suggested)
x16: 16 units - $20,000 (suggested)
```

### SIZE Templates
For products with ordinal sizes (cakes, custom orders):
```
mini: size 1 - $12,000 (suggested)
pequeño: size 2 - $16,000 (suggested)
mediano: size 3 - $25,000 (suggested)
grande: size 4 - $34,000 (suggested)
extra grande: size 5 - $45,000 (suggested)
```

**Note**: Suggested prices in system defaults serve as starting points. Users must set actual basePrice when creating product variations.

### Customizing System Defaults
System administrators can modify `SystemSettings.DEFAULT_VARIATION_TEMPLATES` to:
- Add new variation options
- Modify suggested pricing
- Change naming conventions
- Adjust units or display formats

## API Usage Examples

### Creating a Collection with Custom Variation Templates
```javascript
// User starts with system WEIGHT defaults but customizes them
const collection = new ProductCollection({
  bakeryId: 'bakery-123',
  name: 'Artisan Breads',
  description: 'Handcrafted sourdough and specialty breads',
  defaultVariationType: 'WEIGHT',
  variationTemplates: [] // Start empty, will add custom templates
});

// User customizes variation templates (removes mini, modifies sizes, adds custom)
collection.addVariationTemplate({
  name: 'personal',      // Modified from "pequeño"
  value: 450,            // Custom value (not 550g from system)
  unit: 'g',
  type: 'WEIGHT',
  isWholeGrain: false
});

collection.addVariationTemplate({
  name: 'sharing',       // Modified from "mediano"
  value: 1200,           // Custom value (not 950g from system)
  unit: 'g',
  type: 'WEIGHT',
  isWholeGrain: false
});

collection.addVariationTemplate({
  name: 'party loaf',    // Completely custom addition
  value: 2500,           // Beyond system defaults
  unit: 'g',
  type: 'WEIGHT',
  isWholeGrain: false
});

// Result: Collection now has custom templates that override system defaults
```

### Creating a Product with Variations
```javascript
const product = new Product({
  bakeryId: 'bakery-123',
  name: 'sourdough bread',
  collectionId: 'collection-123',
  variations: [
    new ProductVariation({
      name: 'pequeño',
      value: 500,
      basePrice: 16000,
      unit: 'g',
      type: 'WEIGHT',
      isWholeGrain: false
    }),
    new ProductVariation({
      name: 'mediano',
      value: 950,
      basePrice: 25000,
      unit: 'g',
      type: 'WEIGHT',
      isWholeGrain: false
    })
  ]
});
```

### Getting Suggested Variations for Product Creation
```javascript
const systemSettings = new SystemSettings();
const collection = await ProductCollection.findById('collection-123');

const suggestions = collection.getSuggestedVariations(
  systemSettings.defaultVariationTemplates
);

// Returns:
// {
//   collectionTemplates: [/* collection-specific templates */],
//   systemDefaults: {
//     WEIGHT: { /* weight templates */ },
//     QUANTITY: { /* quantity templates */ },
//     SIZE: { /* size templates */ }
//   }
// }
```

### Order Creation with Variations
```javascript
const orderItem = {
  productId: 'product-123',
  productName: 'sourdough bread',
  quantity: 2,
  basePrice: 16000,
  currentPrice: 15000, // Discount applied
  variation: {
    id: 'var-123',
    name: 'pequeño',
    value: 500,
    isWholeGrain: false
    // Snapshot of variation at order time
  }
};
```

## Migration & Compatibility

### Backward Compatibility Strategy
The system maintains full backward compatibility with existing data:

#### Legacy ProductVariation Data
```javascript
// Old format (still supported)
{
  name: 'pequeño',
  value: 500,
  basePrice: 16000,
  currentPrice: 15000  // This field is ignored in new system
}

// New format
{
  name: 'pequeño',
  value: 500,
  basePrice: 16000     // Only basePrice, no currentPrice
  unit: 'g',
  type: 'WEIGHT'
}
```

#### Migration Handling
```javascript
// In Product.fromFirestore()
variations: data.variations?.map(v => {
  // Handle legacy data that might have currentPrice
  if (v.currentPrice && !v.basePrice) {
    return ProductVariation.fromLegacy(v);
  }
  return new ProductVariation(v);
})

// ProductVariation.fromLegacy()
static fromLegacy(data) {
  const variation = new ProductVariation(data);
  
  // If there's a currentPrice but no basePrice, use currentPrice as basePrice
  if (data.currentPrice && !data.basePrice) {
    variation.basePrice = data.currentPrice;
  }
  
  return variation;
}
```

### Order Data Preservation
Orders created before the new system maintain their original variation structure:
- Existing orders unchanged
- Historical data preserved
- currentPrice values remain in old orders
- New orders use new snapshot format

### Collection Upgrade Path
Existing ProductCollections without variation templates:
- Continue to work normally
- Can be enhanced with variationTemplates at any time
- No breaking changes to existing functionality
- Gradual adoption possible

## Best Practices

### For Collection Setup
1. **Choose appropriate defaultVariationType** based on your product category
2. **Create meaningful variation templates** that will be reused across products
3. **Use consistent naming** for similar variations across collections
4. **Order templates logically** (small to large, few to many)

### For Product Creation
1. **Start with collection templates** for consistency
2. **Set realistic basePrice values** for catalog accuracy
3. **Use system defaults sparingly** to avoid too many options
4. **Test variation display** in customer-facing interfaces

### For Development
1. **Always use ProductVariation class** for type safety
2. **Handle legacy data gracefully** in migration scenarios  
3. **Validate input data** before creating variations
4. **Use display methods** for consistent formatting
5. **Preserve order snapshots** for historical accuracy

## Testing

The system includes comprehensive test coverage:

- **ProductService Tests**: 9/9 passing - Product creation, updates, variations
- **ProductCollection Tests**: 8/8 passing - Collection management, templates
- **ProductCollection Controller**: 8/8 passing - API endpoints, validation
- **Total**: 25/25 tests passing

Key test scenarios:
- Creating products with multiple variations
- Collection template management
- Backward compatibility with legacy data
- Validation error handling
- Order creation with variations
- System default integration

---

This documentation serves as the complete reference for the Product Variations System, covering both technical implementation and user experience considerations.