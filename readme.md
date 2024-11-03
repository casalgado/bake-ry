# Bakery Management System: Products, Recipes, and Ingredients

## Core Relationships

### Products and Recipes (1:1)
- Each product must have exactly one recipe
- Each recipe can only be used by one product
- If you need to sell the same recipe in different ways (e.g., different sizes), use product variations instead of creating new products

### Recipes and Ingredients (1:Many)
- A recipe contains multiple ingredients
- Each ingredient can be used in multiple recipes
- Ingredients in a recipe must be either all resale or all manufactured (cannot mix)

## Type System

The system uses a simple, derived type system:

### Types (Resale vs Manufactured)
- Types are NOT stored explicitly in any model
- Types are derived from the ingredients in a recipe
- There are only two possible types:
  1. **Resale**: If ANY ingredient in the recipe is marked as `isResaleProduct: true`
  2. **Manufactured**: If ALL ingredients in the recipe are `isResaleProduct: false`

### Type Rules
- A recipe cannot mix resale and manufactured ingredients
- A product's type is determined by its recipe's ingredients
- Type is always computed, never stored

## Category System

Categories exist as a separate collection for each bakery:

### Product Categories
- Stored in `bakeries/{bakeryId}/productCategories` collection
- Each product references a category by ID
- Recipes don't have categories (they inherit categorization through their associated products)
- Categories are customizable per bakery
- Categories can be managed independently of other data

## Best Practices

1. **Creating New Products**
   - First create the recipe
   - Then create the product referencing the recipe
   - Use variations for size/price differences of the same product

2. **Managing Categories**
   - Create categories in the productCategories collection
   - Assign category IDs when creating products
   - Use consistent category naming conventions

3. **Working with Types**
   - Never try to set type manually
   - Always let type be determined by ingredients
   - Keep recipes either all resale or all manufactured ingredients

4. **Ingredients**
   - Clearly mark ingredients as resale or not when creating them
   - Consider the impact on recipes when changing an ingredient's resale status