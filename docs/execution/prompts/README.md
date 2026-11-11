# Prompts por etapa

Cada etapa tiene **3 prompts**, en orden y cada uno en una sesión nueva:

1. **Sonnet — configuración**: servicios externos que pida la etapa y creación de la rama.
2. **DeepSeek — código**: todas las tareas de la etapa, una por una, con un commit por tarea. Si la sesión se corta, se pega el mismo prompt y retoma.
3. **Sonnet — revisión**: pruebas, diseño, seguridad, arreglos, merge y deploy. Si deja fixes, se vuelve al prompt 2 (los resuelve primero) y después al 3.

Al final de todo: revisión general en [`../03-revision-sonnet.md`](../03-revision-sonnet.md) §B.

| Etapa | Archivo | Contenido | Tareas |
|---|---|---|---|
| 00 | [etapa-00.md](etapa-00.md) | Fundaciones | 3 |
| 01 | [etapa-01.md](etapa-01.md) | Auth y grupos | 7 |
| 02 | [etapa-02.md](etapa-02.md) | Recetario manual | 9 |
| 03 | [etapa-03.md](etapa-03.md) | Modo cocinar | 8 |
| 04 | [etapa-04.md](etapa-04.md) | Compartir | 6 |
| 05 | [etapa-05.md](etapa-05.md) | IA: importar recetas y voz | 6 |
| 05b | [etapa-05b.md](etapa-05b.md) | Preguntale: asistente | 5 |
| 06 | [etapa-06.md](etapa-06.md) | Perfil alimentario | 7 |
| 07 | [etapa-07.md](etapa-07.md) | Plan semanal + Hoy | 14 |
| 08 | [etapa-08.md](etapa-08.md) | Lista de compras | 6 |
| 08b | [etapa-08b.md](etapa-08b.md) | Plan vivo | 9 |
| 09 | [etapa-09.md](etapa-09.md) | Meal prep y tips | 4 |
| 10 | [etapa-10.md](etapa-10.md) | Notificaciones y pulido | 6 |

Si cambia el plan: `python3 scripts/gen-execution-prompts.py .`
