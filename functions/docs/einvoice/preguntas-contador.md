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

## Preguntas

### RUT y régimen

**1. ¿El RUT de la panadería está vigente y actualizado? ¿Qué responsabilidades tiene (48 IVA, régimen ordinario o Simple)?**

Respuesta: Régimen Simple (RST). Falta confirmar en el RUT si es responsable o no responsable de IVA.


**2b. ¿Cuál es su resolución de numeración actual en Alegra: prefijo, rango, fecha de vigencia y consecutivo en el que van? ¿Hay una resolución aparte para POS?**

Respuesta:

**3. ¿El representante legal tiene su firma electrónica DIAN (IFE) activa?**

Respuesta:

### Impuestos de los productos

**4. El café en grano, ¿lleva IVA 5% o impuesto al consumo (INC)? (Hoy en el sistema está con IVA 5%; el pan y el domicilio van excluidos, como en Alegra.)**

Respuesta:

**5. ¿Les aplican retenciones (retefuente, reteIVA, reteICA), o se las practican sus clientes? ¿Deben aparecer en la factura?**

Respuesta:

### Cuándo y a quién se factura

**6. ¿En qué momento se debe expedir la factura: al hacer el pedido, al entregar o al cobrar?**

Respuesta:

**7. ¿Qué datos del cliente deben pedirse (tipo y número de documento, correo, ciudad) B2B y B2C?**

Respuesta:

**8. Las ventas de mostrador: ¿van con factura de venta o con documento equivalente POS? ¿Desde qué monto, si hay uno, pueden venderse sin identificar al comprador?**

Respuesta:

### Casos especiales

**9. Obsequios o cortesías (productos con precio 0): ¿cómo se declaran?**

Respuesta:

**10. Domicilios o envíos, van aparte? Como se facturan?**

Respuesta: No se cobra IVA. Va como un ítem más de la factura.

**11. Pagos parciales y ventas a crédito: ¿cómo se expresan en la factura?**

Respuesta:

**12. Devoluciones y anulaciones: ¿cuándo se hace una nota crédito y cuándo no? ¿Qué plazo hay?**

Respuesta:

### Numeración y operación

**13. ¿Qué prefijo prefieren y cuántas facturas esperan al mes? ¿Numeración separada para factura y POS?**

Respuesta:

**16. Como se estan procesando actualmente las facturas de pagos de servicios y otros gastos, como se genera el PyG?**

**13b. Para que el software nuevo y Alegra convivan sin chocar, proponemos pedir una resolución nueva con un prefijo distinto. ¿Están de acuerdo? ¿Hay algún inconveniente contable en tener dos prefijos activos durante la transición?**

Respuesta:

**13c. ¿Cuándo quieren dejar de usar Alegra para facturar, y qué hacen con las facturas históricas que quedan allá?**

Respuesta:

**14. ¿Qué hacen si no hay internet o la DIAN está caída (contingencia)?**

Respuesta:

**15. ¿Como procesamos esas facturas una vez las hagamos?**

Respuesta:


