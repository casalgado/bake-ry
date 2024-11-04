# Model Change Impact Table

| Model     | Method            | Triggers Change | Description |
|-----------|------------------|----------------|-------------|
| Product   | CREATE           | Yes            | Links to Recipe (recipeId), recipe cannot be used by other products |
| Product   | UPDATE (recipe)  | Yes            | Old recipe becomes available, new recipe becomes locked to this product |
| Product   | UPDATE (variations) | No          | Only affects product pricing/scaling, no impact on recipe/ingredients |
| Product   | DELETE           | Yes            | Recipe becomes available for other products |
|-----------|------------------|----------------|-------------|
| Ingredient | CREATE          | No             | - |
| Ingredient | UPDATE (cost)   | Yes            | Updates cost in all related Recipes and affects Product costs |
| Ingredient | DELETE          | No             | Blocked if used in active recipes |
|-----------|------------------|----------------|-------------|
| Recipe    | CREATE          | Yes             | Updates usedInRecipes array in Ingredients |
| Recipe    | UPDATE (ingredients) | Yes        | Updates usedInRecipes in affected Ingredients, affects Product costs |
| Recipe    | DELETE          | Yes             | Updates usedInRecipes in Ingredients, blocked if linked to active Product |

## Key Observations:

### Change Propagation Flow:
1. Product Impact:
- Mainly affected by changes in other models
- Primary impact is recipe availability management
- Variations only affect internal product calculations

2. Protection Rules:
- Cannot delete ingredients used in active recipes
- Cannot delete recipes linked to active products
- Cannot use a recipe already linked to another product

3. Cost Update Chain:
- Ingredient cost changes → Recipe cost updates → Product price impacts