# Árbol de decisión del agente (v0.1)

Máximo 4 preguntas antes de recomendar. Si el usuario ya dio el dato en texto libre, se salta la pregunta.

```
Inicio → saludo + aviso LOPDP (1 línea) → "¿Qué buscas hoy?"
 ├─ "Ver modelos / cuál me conviene" → PERFIL
 ├─ "Info de un modelo" → DETALLE(modelId)  [hotspots → view_3d]
 ├─ "Prueba de manejo" → CONTACTO → CITA(test_drive)
 └─ "Taller / mantenimiento" → CONTACTO → CITA(service)

PERFIL
 P1 Uso principal: ciudad | carretera | trabajo/carga
 P2 Pasajeros habituales: 1-2 | 3-5 | más
 P3 Presupuesto aprox (USD): <25k | 25-35k | 35-45k | >45k
 P4 ¿Puedes cargar en casa/trabajo?: sí | no   (no → priorizar PHEV)
 → POST /recommendations(profile) → 3 modelos con razón
 → "¿Quieres ver el Dolphin en 3D / dejar tus datos / agendar prueba?"

CONTACTO (siempre antes de CITA)
 nombre, teléfono (EC), email opcional, consentimiento → POST /leads
 → crmStatus: pushed (HubSpot)

CITA
 tipo, fecha → GET /availability → elegir slot → POST /appointments
 → confirmación + "un asesor te contactará en horario de oficina"
```

Reglas de scoring fallback (sin LLM): puntaje = cercanía al presupuesto (peso 3) + match de `idealFor` con uso/pasajeros (peso 2) + `sin cargador` → +3 a PHEV. Top 3.
