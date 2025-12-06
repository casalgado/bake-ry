# Duplicate Phone Numbers Report
**Generated:** 2025-12-05

## Overview
This report identifies users with duplicate phone numbers across bakeries. These duplicates need to be resolved before enabling phone uniqueness constraints.

---

## DIANA_LEE Bakery (9 duplicate pairs)

### Same Person - Duplicates (need merge or cleanup)

#### 1. Phone: 573106398349 - Sandra Villalba
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| 0PKRqtu1njAJKhC0aUyt | Sandra Villalba | 1 | 110,800 | 2025-11-27 16:05 | qszs@pendiente.com |
| TxKTf6ceCFeFDcHu0tzd | Sanda Villalba (typo) | 1 | 110,800 | 2025-11-27 12:18 | eh95@pendiente.com |

**Analysis:** Same person, name typo. Both have orders.
**Recommendation:** Merge orders to newer account, soft-delete older, or clear phone from one.

---

#### 2. Phone: 573158007392 - Fanny Sales
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| 2lj4IaoZNZ18Zuoe7g2j | Fanny Sales (newer) | 0 | 0 | 2025-10-11 02:30 | 2141@pendiente.com |
| b1a7nR5h7l8Vqvroqk3S | Fanny Sales (older) | 1 | 552,000 | 2025-10-07 12:29 | 9z2n@pendiente.com |

**Analysis:** Same person, duplicate account created.
**Recommendation:** Clear phone from newer account (no orders). Keep older.

---

#### 3. Phone: 573205499159 - Edith Mitchell
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| ilUE2Ab8wmk1IgJ9jGol | Edith Mitchell (newer) | 0 | 0 | 2025-10-11 02:32 | 0xxf@pendiente.com |
| QUzhqfybsrksk560YKXT | Edith Mitchell (older) | 1 | 321,000 | 2025-10-06 23:18 | x5k3@pendiente.com |

**Analysis:** Same person, duplicate account created.
**Recommendation:** Clear phone from newer account (no orders). Keep older.

---

#### 4. Phone: 573003251726 - Laura Hasbun
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| vxQNieZCJeiqDY1vyJ0Y | Laura Hasbun (newer) | 1 | 162,000 | 2025-08-21 20:57 | stss@pendiente.com |
| kjKTorgsHasvaRSgv1NJ | Laura Hasbun (older) | 1 | 205,000 | 2025-06-27 16:47 | x1cj@pendiente.com |

**Analysis:** Same person, duplicate account created. Both have orders.
**Recommendation:** Merge orders to one account, clear phone from the other.

---

#### 5. Phone: 573126217704 - Pily / Maria del Pilar Juliao
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| WSwsyZSoarT6V80Qos9D | Pily Juliao (nickname) | 1 | 123,600 | 2025-07-04 01:44 | d5kh@pendiente.com |
| raNm6Es5sV7loB1kgLVl | Maria del Pilar Juliao | 1 | 291,000 | 2025-06-14 13:47 | ipw6@pendiente.com |

**Analysis:** Same person (Pily is nickname for Maria del Pilar). Both have orders.
**Recommendation:** Merge orders, keep full name account.

---

#### 6. Phone: 573188660522 - Maribel / Maria Isabel Fernandez
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| udZBlVNkilcPocSLqui5 | Maribel Fernandez de Castro | 1 | 116,000 | 2025-07-04 01:46 | u56c@pendiente.com |
| 9VpbcqhXOfmnJW0OP2KU | Maria Isabel Fernandez de Castro | 1 | 301,000 | 2025-06-14 13:40 | hnff@pendiente.com |

**Analysis:** Same person (Maribel is nickname for Maria Isabel). Both have orders.
**Recommendation:** Merge orders, keep full name account.

---

#### 7. Phone: 573164719798 - Maria Luisa de la Espriella
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| nmg0JbK3cjvb7wBhc1nu | Maria Luisa (newer) | 1 | 176,000 | 2025-07-18 11:54 | as0n@pendiente.com |
| JOLwoNYQTMkhDBsvBn4s | Maria Luisa (older) | 1 | 208,000 | 2025-06-12 20:54 | idi6@pendiente.com |

**Analysis:** Same person, duplicate account created. Both have orders.
**Recommendation:** Merge orders to one account, clear phone from the other.

---

### Different People - Same Phone (need phone cleared from one)

#### 8. Phone: 573157420418 - Valerie Lafaurie / Martha Osorio
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| jxiD83QWNH1jKTvC6Ij8 | Valerie Lafaurie | 1 | 99,000 | 2025-07-11 22:34 | km1h@pendiente.com |
| MCOhjZIbqY80WJd05A5A | Martha Osorio | 1 | 350,800 | 2025-07-11 22:32 | wyl4@pendiente.com |

**Analysis:** DIFFERENT PEOPLE sharing same phone (possibly family/shared phone).
**Recommendation:** Clear phone from Valerie Lafaurie (lower order value). Keep on Martha Osorio.

---

#### 9. Phone: 573167408998 - Mariana Correa / Yulieth Sanchez
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| voMKm6tKahbuDemjESI8 | Mariana Correa | 1 | 114,000 | 2025-07-05 15:26 | wu55@pendiente.com |
| 7to1prcbikVKEmGoMiHs | Yulieth Sanchez | 1 | 357,000 | 2025-06-04 17:29 | p9tx@pendiente.com |

**Analysis:** DIFFERENT PEOPLE sharing same phone (possibly family/shared phone).
**Recommendation:** Clear phone from Mariana Correa (lower order value). Keep on Yulieth Sanchez.

---

## ES-ALIMENTO Bakery (1 duplicate pair)

#### 1. Phone: 3106337197 - Elisa Meza de Guerrero
| User ID | Name | Orders | Total ($) | Created | Email |
|---------|------|--------|-----------|---------|-------|
| X5g8HTPMwfU4qxbcg4IcKP0jDZk1 | Elisa Meza de Guerrero | 0 | 0 | 2024-03-12 14:11 | mezaelisa1956@hotmail.com |
| P7xbs5PALIP90O6X4GaOWZwHTjy2 | Elisa Maria Meza de Guerrero | 0 | 0 | 2024-02-29 16:25 | pendiente@elisamariamezadeguerrero.com |

**Analysis:** Same person, different name variations. Neither has orders. First has real email.
**Recommendation:** Keep first account (has real email), soft-delete or clear phone from second.

---

## Summary of Recommended Actions

### Quick Fix (Clear phone only - no data loss)

| Bakery | User ID | Name | Action |
|--------|---------|------|--------|
| diana_lee | 2lj4IaoZNZ18Zuoe7g2j | Fanny Sales (newer) | Clear phone |
| diana_lee | ilUE2Ab8wmk1IgJ9jGol | Edith Mitchell (newer) | Clear phone |
| diana_lee | jxiD83QWNH1jKTvC6Ij8 | Valerie Lafaurie | Clear phone |
| diana_lee | voMKm6tKahbuDemjESI8 | Mariana Correa | Clear phone |
| es-alimento | P7xbs5PALIP90O6X4GaOWZwHTjy2 | Elisa Maria Meza de Guerrero | Clear phone |

### Requires Decision (Both users have orders)

| Bakery | Phone | User 1 | Orders | User 2 | Orders | Decision Needed |
|--------|-------|--------|--------|--------|--------|-----------------|
| diana_lee | 573106398349 | Sandra Villalba | 1 | Sanda Villalba | 1 | Merge or clear one |
| diana_lee | 573003251726 | Laura Hasbun (newer) | 1 | Laura Hasbun (older) | 1 | Merge or clear one |
| diana_lee | 573126217704 | Pily Juliao | 1 | Maria del Pilar Juliao | 1 | Merge or clear one |
| diana_lee | 573188660522 | Maribel Fernandez | 1 | Maria Isabel Fernandez | 1 | Merge or clear one |
| diana_lee | 573164719798 | Maria Luisa (newer) | 1 | Maria Luisa (older) | 1 | Merge or clear one |

---

## API Commands for Quick Fix

```bash
# Set your token
TOKEN="YOUR_AUTH_TOKEN"
BASE="https://us-central1-bake-ry.cloudfunctions.net/bake"

# Diana Lee - Clear phones (PATCH requests)
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":""}' "$BASE/bakeries/diana_lee/users/2lj4IaoZNZ18Zuoe7g2j"

curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":""}' "$BASE/bakeries/diana_lee/users/ilUE2Ab8wmk1IgJ9jGol"

curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":""}' "$BASE/bakeries/diana_lee/users/jxiD83QWNH1jKTvC6Ij8"

curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":""}' "$BASE/bakeries/diana_lee/users/voMKm6tKahbuDemjESI8"

# ES-Alimento - Clear phone
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":""}' "$BASE/bakeries/es-alimento/users/P7xbs5PALIP90O6X4GaOWZwHTjy2"
```

---

## Notes

- All "pendiente" emails are auto-generated placeholder emails
- Order totals are in the bakery's local currency (likely COP - Colombian Pesos)
- The phone uniqueness constraint was added to `bakeryUserService.js` but cannot be deployed until these duplicates are resolved
