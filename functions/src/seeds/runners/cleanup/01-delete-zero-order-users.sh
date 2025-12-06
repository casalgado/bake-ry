#!/bin/bash
# =============================================================================
# Script 1: Delete Users with 0 Orders
# =============================================================================
# Users to delete:
#   - 2lj4IaoZNZ18Zuoe7g2j (Fanny Sales - newer, 0 orders)
#   - ilUE2Ab8wmk1IgJ9jGol (Edith Mitchell - newer, 0 orders)
# =============================================================================

# Check if TOKEN is set
if [ -z "$TOKEN" ]; then
    echo "ERROR: TOKEN environment variable is not set"
    echo "Usage: TOKEN=\"your-token\" bash $0"
    exit 1
fi

BASE="https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY="diana_lee"

echo "=============================================="
echo "DELETE USERS WITH 0 ORDERS"
echo "Bakery: $BAKERY"
echo "=============================================="
echo ""

# --- User 1: Fanny Sales (newer) ---
echo "=== User 1: Fanny Sales (newer) ==="
echo "User ID: 2lj4IaoZNZ18Zuoe7g2j"
echo ""

echo "Step 1: Check current state..."
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/2lj4IaoZNZ18Zuoe7g2j"
echo ""
echo ""

echo "Step 2: Deleting user..."
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/2lj4IaoZNZ18Zuoe7g2j"
echo ""
echo ""

echo "Step 3: Verify deletion (isDeleted should be true)..."
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/2lj4IaoZNZ18Zuoe7g2j"
echo ""
echo ""

# --- User 2: Edith Mitchell (newer) ---
echo "=== User 2: Edith Mitchell (newer) ==="
echo "User ID: ilUE2Ab8wmk1IgJ9jGol"
echo ""

echo "Step 1: Check current state..."
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/ilUE2Ab8wmk1IgJ9jGol"
echo ""
echo ""

echo "Step 2: Deleting user..."
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/ilUE2Ab8wmk1IgJ9jGol"
echo ""
echo ""

echo "Step 3: Verify deletion (isDeleted should be true)..."
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/bakeries/$BAKERY/users/ilUE2Ab8wmk1IgJ9jGol"
echo ""
echo ""

echo "=============================================="
echo "DONE - Verify both users have isDeleted: true"
echo "=============================================="
