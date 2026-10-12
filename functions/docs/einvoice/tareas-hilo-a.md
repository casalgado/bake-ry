# Facturación electrónica: tareas del hilo A (trámites)

Son los trámites tuyos y de la panadería. Corren en paralelo con el código (hilo B). El certificado es lo más lento, así que se empieza pronto.

Lo marcado con **(verificar con el contador)** no lo pudimos confirmar en fuentes oficiales.

## Tareas

- [ ] **1. Reunión con el contador.** Usa `preguntas-contador.md`. Bloquea cómo se arman los impuestos del XML.
- [ ] **2. Reunir los datos de la panadería:** NIT con dígito de verificación, razón social, dirección y municipio, correo, responsabilidades del RUT, actividad económica, representante legal.
- [ ] **3. Confirmar que el representante legal tiene cuenta DIAN y firma electrónica (IFE) activas.** (verificar con el contador)
- [ ] **4. Cotizar el certificado en 2 o 3 entidades** (Uanataca, Certicámara, GSE, Andes SCD, Camerfirma, Viafirma). Pedir:
  - Persona jurídica, para facturación electrónica ante la DIAN.
  - **Modalidad archivo `.p12`, no token USB.** El token no se puede exportar y el servidor tiene que firmar solo.
  - Precio con IVA, vigencia, tiempo de entrega y proceso de validación de identidad.
  - Referencia 2025: unos $150.000 a $300.000 COP al año.
- [ ] **5. Comprar el certificado.** Entregarme el `.p12` y su clave por un canal seguro, nunca por correo ni chat. Yo lo cargo en Secret Manager y esto lo hacemos juntos.
- [ ] **6. Registro en el portal de habilitación** (`catalogo-vpfe.dian.gov.co`): generar token y registrar el modo de operación "Software propio". Me entregas el ID del software, el PIN y el TestSetId.
- [ ] **7. Correr el set de pruebas conmigo** (60 facturas, 20 notas crédito, 20 notas débito) cuando termine la fase B3 del código.
- [ ] **8. Con el estado "Habilitado":** elegir la fecha de inicio de facturación electrónica y pedir la numeración en MUISCA (prefijo y rango). (verificar con el contador)
- [ ] **9. Asociar la numeración en el portal de habilitación** y entregarme prefijo, rango y vigencia.
- [ ] **10. Producción:** primera factura real, en conjunto.

## Qué necesito de ti y cuándo

| Fase de código (hilo B) | Qué hago yo | Qué necesito de ti |
|---|---|---|
| B1. Núcleo | CUFE y generador de XML, validados contra los XSD y ejemplos de la DIAN | Respuestas del contador (tarea 1) sobre impuestos |
| B2. Firma | Firma XAdES, probada con un certificado autofirmado | Nada |
| B3. Cliente DIAN | Cliente SOAP, persistencia, contador de consecutivos, endpoint, set de pruebas | Certificado (5), datos de habilitación (6), set de pruebas (7) |
| B4. Producción | PDF con QR, correo al cliente, manejo de rechazos | Numeración (8, 9) |
| B5. Notas crédito y débito | Anular o corregir facturas aceptadas | Respuesta 12 del contador |
| B6. POS | Proyecto aparte | Respuesta 8 del contador |
