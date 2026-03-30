# Quizant Design Tokens

This file maps every CSS custom property in the app to its purpose.
Designers: map your Figma token names to the variable names in this file.
Engineers: reference these variable names in all new components.

## Colours
| Token name | Current value (Light) | Used for |
|---|---|---|
| --background | 36 33% 97% | Page background |
| --foreground | 216 60% 5% | Primary text |
| --card | 0 0% 100% | Card background |
| --card-foreground | 216 60% 5% | Text on cards |
| --popover | 0 0% 100% | Popover background |
| --popover-foreground | 216 60% 5% | Text on popovers |
| --primary | 13 71% 50% | Brand orange, CTAs, active states |
| --primary-foreground | 36 33% 97% | Text on primary colour |
| --secondary | 260 50% 98% | Secondary actions and backgrounds |
| --secondary-foreground | 216 60% 5% | Text on secondary colour |
| --muted | 40 26% 93% | Subtle backgrounds |
| --muted-foreground | 216 15% 45% | Secondary text |
| --accent | 36 33% 97% | Hover states and accents |
| --accent-foreground | 216 60% 5% | Text on accent elements |
| --destructive | 357 96% 60% | Errors, delete actions |
| --destructive-foreground | 210 17% 98% | Text on destructive elements |
| --success | 160 84% 39% | Success indicators, generic positive actions |
| --success-foreground | 210 17% 98% | Text on success elements |
| --warning | 42 100% 70% | Warnings, alerts |
| --warning-foreground | 216 60% 5% | Text on warnings |
| --info | 216 60% 5% | Informational alerts |
| --info-foreground | 210 17% 98% | Text on info elements |
| --border | 220 13% 91% | All borders |
| --input | 220 13% 91% | Inputs borders |
| --ring | 13 71% 50% | Focus rings matching primary |
| --highlight | 13 71% 50% / 0.08 | Subtle highlight matching primary |
| --sidebar-background | 36 33% 97% | Sidebar background |
| --sidebar-foreground | 216 60% 5% | Sidebar primary text |
| --sidebar-primary | 13 71% 50% | Sidebar active states |
| --sidebar-primary-foreground | 36 33% 97% | Text on sidebar active items |
| --sidebar-accent | 40 26% 93% | Sidebar hover backgrounds |
| --sidebar-accent-foreground | 216 60% 5% | Text on sidebar hover states |
| --sidebar-border | 220 13% 91% | Sidebar border dividers |
| --sidebar-ring | 13 71% 50% | Sidebar focus rings |

## Typography
Typography is managed via default Tailwind classes (`text-sm`, `font-bold`, etc.) and Google Fonts initialized in `index.css` (`Inter`, `Space Grotesk`, `Merriweather`).

## Spacing
Spacing is managed strictly via standard Tailwind spacing tokens (e.g. `p-4`, `m-2`).

## Border Radius
| Token name | Current value | Used for |
|---|---|---|
| --radius | 1rem | General corner rounding across cards and panels |

## Shadows
Shadows leverage native Tailwind utilities (`shadow-sm`, `shadow-md`, `shadow-xl`)

## Subject Colours
These are hardcoded and must not be changed by the AI agent without a ticket:
| Subject | Token | Value |
|---|---|---|
| English | --subject-english | #22c55e |
| Mathematics | --subject-maths | #3b82f6 |
| Physics | --subject-physics | #a855f7 |
| Chemistry | --subject-chemistry | #f97316 |
