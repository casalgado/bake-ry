# Facturación electrónica: preguntas para el contador

## Resumen para validar

- Queremos emitir **facturas electrónicas de venta** con **software propio**, sin proveedor tecnológico. Después, **documento equivalente POS**.
- La panadería, como persona jurídica, haría tres trámites propios:
  1. Comprar un **certificado de firma digital** (archivo `.p12`) a una entidad autorizada. Cuesta unos $150.000 a $300.000 COP al año (precios de 2025).
  2. Habilitarse en el portal de habilitación de la DIAN, en modo "Software propio", y pasar el **set de pruebas** (60 facturas, 20 notas crédito, 20 notas débito).
  3. Pedir en MUISCA la **resolución de numeración**: prefijo y rango de consecutivos.
- Nuestro software genera el XML (UBL 2.1), lo firma con el certificado y lo envía a la DIAN. La DIAN responde si lo acepta o lo rechaza.
- La DIAN actualiza el RUT en la fecha de inicio elegida y agrega la responsabilidad 37 (obligado a facturar electrónicamente).
- El número de factura es prefijo más consecutivo, único por empresa. El CUFE (código único de la factura) es único a nivel nacional.
- Verificamos el anexo técnico v1.9 (Resolución 165 de 2023), que sigue vigente. **No** verificamos en fuentes oficiales los pasos exactos en MUISCA ni los requisitos del RUT, por eso las preguntas 1 a 3.

## Preguntas

### RUT y régimen

**1. ¿El RUT de la panadería está vigente y actualizado? ¿Qué responsabilidades tiene (48 IVA, régimen ordinario o Simple)?**

Respuesta:

**2. Hoy facturan con Alegra. ¿Quién compró el certificado de firma digital: la panadería, o lo gestiona Alegra con el suyo? ¿La panadería tiene el archivo (`.p12`) y su contraseña? ¿Cuándo vence?**

Respuesta:

**2b. ¿Cuál es su resolución de numeración actual en Alegra: prefijo, rango, fecha de vigencia y consecutivo en el que van? ¿Hay una resolución aparte para POS?**

Respuesta:

**2c. ¿Hay contrato o plan con Alegra con fecha de vencimiento? ¿Alegra es también su software contable, o solo factura?**

Respuesta:

**3. ¿Quién es el representante legal que hará los trámites, y tiene su firma electrónica DIAN (IFE) activa?**

Respuesta:

### Impuestos de los productos

**4. ¿Qué impuesto lleva cada tipo de producto: IVA 19%, IVA 5%, impuesto al consumo, excluido o exento? ¿Algo cambia si se consume en el local o se lleva?**

Respuesta:

**5. ¿Les aplican retenciones (retefuente, reteIVA, reteICA), o se las practican sus clientes? ¿Deben aparecer en la factura?**

Respuesta:

### Cuándo y a quién se factura

**6. ¿En qué momento se debe expedir la factura: al hacer el pedido, al entregar o al cobrar?**

Respuesta:

**7. ¿A quiénes facturan: empresas (NIT), personas naturales o consumidor final? ¿Qué datos del cliente deben pedirse (tipo y número de documento, correo, ciudad)?**

Respuesta:

**8. Las ventas de mostrador: ¿van con factura de venta o con documento equivalente POS? ¿Desde qué monto, si hay uno, pueden venderse sin identificar al comprador?**

Respuesta:

### Casos especiales

**9. Obsequios o cortesías (productos con precio 0): ¿cómo se declaran?**

Respuesta:

**10. Domicilios o envíos y propinas: ¿llevan IVA, o van aparte?**

Respuesta:

**11. Pagos parciales y ventas a crédito: ¿cómo se expresan en la factura?**

Respuesta:

**12. Devoluciones y anulaciones: ¿cuándo se hace una nota crédito y cuándo no? ¿Qué plazo hay?**

Respuesta:

### Numeración y operación

**13. ¿Qué prefijo prefieren y cuántas facturas esperan al mes? ¿Numeración separada para factura y POS?**

Respuesta:

**13b. Para que el software nuevo y Alegra convivan sin chocar, proponemos pedir una resolución nueva con un prefijo distinto. ¿Están de acuerdo? ¿Hay algún inconveniente contable en tener dos prefijos activos durante la transición?**

Respuesta:

**13c. ¿Cuándo quieren dejar de usar Alegra para facturar, y qué hacen con las facturas históricas que quedan allá?**

Respuesta:

**14. ¿Qué hacen si no hay internet o la DIAN está caída (contingencia)?**

Respuesta:

**15. ¿Usan software contable (Siigo, World Office, etc.) que necesite recibir las facturas?**

Respuesta:
