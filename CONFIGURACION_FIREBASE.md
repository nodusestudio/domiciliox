# DomicilioX - Configuración

## Variables de Entorno Firebase

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
VITE_COMPANY_NAME=DomicilioX
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

## Reglas de Seguridad Firestore

**IMPORTANTE**: Copia estas reglas exactamente en Firebase Console → Firestore Database → Reglas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ⚠️ MODO DESARROLLO - Permite lectura/escritura sin autenticación
    // Para producción, implementar autenticación y restaurar reglas seguras
    
    // Regla para historial_domicilios
    match /historial_domicilios/{document} {
      allow read, write: if true;
    }
    
    // Regla para pedidos_domicilio
    match /pedidos_domicilio/{document} {
      allow read, write: if true;
    }
    
    // Regla para clientes
    match /clientes/{document} {
      allow read, write: if true;
    }
    
    // Regla para repartidores
    match /repartidores/{document} {
      allow read, write: if true;
    }
  }
}
```

**Reglas Seguras (para futuro con autenticación)**:
```javascript
// Descomenta estas reglas cuando implementes autenticación
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /historial_domicilios/{document} {
      allow read, write: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
    }
    
    match /pedidos_domicilio/{document} {
      allow read, write: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
    }
    
    match /clientes/{document} {
      allow read, write: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
    }
    
    match /repartidores/{document} {
      allow read, write: if request.auth != null 
        && request.resource.data.userId == request.auth.uid;
    }
  }
}
*/
```

## Estructura de Datos

### historial_domicilios
```javascript
{
  userId: "uid_del_usuario",
  fecha: "28/12/2025",
  timestamp: serverTimestamp(),
  pedidos: [
    {
      cliente: "Juan Pérez",
      direccion: "Calle 45 #12-34",
      telefono: "3001234567",
      valor_pedido: 50000,
      costo_envio: 5000,
      total_a_recibir: 45000,
      metodo_pago: "Efectivo",
      entregado: true,
      hora: "14:30"
    }
  ],
  totales: {
    cantidad_pedidos: 10,
    total_valor_pedidos: 500000,
    total_costos_envio: 50000,
    total_a_recibir: 450000,
    total_efectivo: 300000,
    total_tarjeta: 150000
  }
}
```

## Funcionalidades Implementadas

✅ **Despacho Rápido (Orders.jsx)**
- Buscador con auto-insert de pedidos
- Timestamp automático con serverTimestamp()
- Numeración automática del día
- Toggle Efectivo/Tarjeta
- Checkbox de entregado
- **Cierre de Jornada** con totales automáticos
- **Botón "Guardar Todo"** que persiste en Firebase

✅ **Reportes (Reportes.jsx)**
- Búsqueda por rango de fechas
- Resumen de período con totales generales
- Vista detallada de cada jornada
- Desglose por método de pago
- Filtrado automático por userId

✅ **Persistencia Firebase**
- Colección: `historial_domicilios`
- Seguridad multi-tenant con userId
- Timestamps automáticos
- Mensajes de éxito: "Información guardada con éxito"

## Uso

1. **Crear Pedidos**: Busca cliente → Ingresa valores → Pedido creado automáticamente
2. **Cerrar Jornada**: Revisa totales → Click "Guardar Todo" → Jornada guardada en Firebase
3. **Ver Reportes**: Ve a Análisis → Selecciona fechas → Click Buscar → Expande jornadas

## Comandos

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview
npm run preview
```
