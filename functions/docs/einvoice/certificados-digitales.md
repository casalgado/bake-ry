# Digital certificate providers (DIAN e-invoicing)

Research date: 2026-10-17. No provider publishes a 2026 price list; figures come from Andes SCD's policy (2024 list), Uanataca's tariff page and reseller sites. Get quotes before buying.

## Requirement

- Certificate type **facturación electrónica** — a generic "firma digital" certificate may not work with DIAN.
- Delivered as **.p12/.pfx or issued from a CSR** (PKCS#10). No USB token: the server signs unattended.
- Each client NIT needs its own certificate.
- Persona jurídica docs: cámara de comercio (< 30 days), RUT, legal representative ID.

## Providers

| Provider | Price / year | Pros | Cons |
|---|---|---|---|
| **Andes SCD** (direct) | 275k + IVA (1 yr), 495k + IVA (2 yrs), 2024 list; replacement ~63k for persona jurídica | 100% online. Issues from a **CSR**: we generate the private key, Andes never sees it, so it goes straight to Secret Manager. Policy covers "plataformas de firma desatendida". Has web service/API, useful when scaling. | Highest published list price. Policy PDF is from 2024. |
| **GSE** (direct) | Not published | ONAC-accredited since 2008. Described as quick to process and competitive for small businesses. Some resellers sell GSE certificates. | No public prices. CSR issuance not confirmed. |
| **Certicámara** (direct) | Quote only | Best known, backed by chambers of commerce. Accredited until 2029. | Opaque pricing, likely the most expensive. Corporate sales process. |
| **Uanataca Colombia** | ~278k persona jurídica (also lists ~173k) | Publishes prices. | Smaller player. Unclear which certificate the 173k price is for. |
| **Camerfirma / Thomas Signe** | Not published | Chamber of commerce offices in several cities. Thomas Signe is the multinational option. | Camerfirma's current ONAC accreditation not confirmed. |
| **Resellers** (Sensiyo, Puvesoft, POS Colombia) | 120–130k (1 yr), 210–220k (2 yrs) | About half the price. Same-day, .p12 + PIN. | Middleman. Usually the provider generates the key, so a copy of our private key passes through a third party. Renewal and support depend on the reseller. |
| **Free DIAN certificate** | 0 | Free. | Per DIAN, only for users of its free invoicing service. Software propio needs an ONAC-accredited provider. **Ruled out.** |

## Recommendation

- **Pilot:** Andes SCD via CSR. The ~150k/yr premium buys a private key that never leaves our hands, and a CSR + API flow we can automate per client later.
- **Scaling:** pass the certificate cost to each client, or negotiate a volume deal with Andes or GSE (their policies allow special commercial agreements).

## Questions to ask each provider

1. Do you issue from a CSR (PKCS#10)?
2. Price for persona jurídica, IVA included, 1 and 2 years?
3. Issuance time?
4. Reseller or volume plan?

## Sources

- [Andes SCD – Política de certificación facturación electrónica v1.7](https://www.andesscd.com.co/docs/pc_facturacionelectronica_v1.7.pdf)
- [DIAN – La verdad detrás de la facturación gratuita y el certificado gratuito](https://www.dian.gov.co/Prensa/Paginas/BlogDetails.aspx?DianId=23)
- [DIAN – Pasos para facturar electrónicamente](https://www.dian.gov.co/Prensa/Paginas/NG-3-pasos-para-facturar-electronicamente.aspx)
- [POS Colombia – dónde comprar el certificado (2026)](https://poscolombia.com/blog/certificado-digital-dian-donde-comprar-cuanto-cuesta)
- [Sensiyo – certificados digitales](https://sensiyo.co/certificados-digitales/)
- [Puvesoft – certificado digital DIAN](https://www.puvesoft.com/certificados-digitales.php)
- [Uanataca – política tarifaria](https://uanataca.co/documentos/POLITICA%20TARIFARIA.pdf)
- [ONAC – acreditación GSE 16-ECD-001](https://onac.org.co/certificados/16-ECD-001.pdf)
- [Certicámara – firmas digitales](https://web.certicamara.com/servicios/firmas-digitales)
- [lastopdelatam – proveedores de firma electrónica 2026](https://lastopdelatam.com/co/firma-electronica/mejores-proveedores-firma-electronica-colombia)
