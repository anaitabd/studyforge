# StudyForge — Université + Formation Professionnelle Marocaine

## Read first
```bash
cat apps/api/app/services/curriculum_service.py
cat apps/api/app/services/exam_service.py
cat apps/api/app/services/grading_service.py
```

---

## Part 1 — University levels (Enseignement Supérieur)

### Moroccan university system specifics

Public universities: Mohammed V (Rabat), Hassan II (Casablanca), Cadi Ayyad (Marrakech), Sidi Mohammed Ben Abdellah (Fès), Ibn Tofail (Kénitra), etc.

Grandes écoles: ENSA, ENCG, ENSIAS, INSEA, ISCAE, UM6P, Al Akhawayn (English-medium).

Medical/Pharmacy: 6–7 years, highly competitive, national numerus clausus.

Add to `curriculum_service.py`:

```python
SUPERIEUR_LEVELS = {
    # Public university — Licence-Master-Doctorat (LMD)
    "L1": {"label": "Licence 1 — Bac+1", "cycle": "licence", "system": "lmd"},
    "L2": {"label": "Licence 2 — Bac+2", "cycle": "licence", "system": "lmd"},
    "L3": {"label": "Licence 3 — Bac+3", "cycle": "licence", "system": "lmd"},
    "M1": {"label": "Master 1 — Bac+4", "cycle": "master", "system": "lmd"},
    "M2": {"label": "Master 2 — Bac+5", "cycle": "master", "system": "lmd", "high_stakes": True},
    "DOCTORAT": {"label": "Doctorat — Bac+8", "cycle": "doctoral"},

    # Grandes écoles
    "CPGE_MP": {"label": "CPGE Maths-Physique", "cycle": "cpge", "high_stakes": True},
    "CPGE_PC": {"label": "CPGE Physique-Chimie", "cycle": "cpge", "high_stakes": True},
    "CPGE_TSI": {"label": "CPGE TSI", "cycle": "cpge"},
    "ENSA": {"label": "ENSA (Ingénieur)", "cycle": "grande_ecole", "years": 3},
    "ENCG": {"label": "ENCG (Gestion)", "cycle": "grande_ecole", "years": 3},
    "ENSIAS": {"label": "ENSIAS (Informatique)", "cycle": "grande_ecole", "years": 3},
    "INSEA": {"label": "INSEA (Statistiques)", "cycle": "grande_ecole", "years": 3},
    "ISCAE": {"label": "ISCAE (Commerce)", "cycle": "grande_ecole", "years": 3},

    # BTS (Brevet de Technicien Supérieur)
    "BTS_INFO": {"label": "BTS Informatique", "cycle": "bts", "years": 2},
    "BTS_COMPTA": {"label": "BTS Comptabilité", "cycle": "bts", "years": 2},
    "BTS_COMMERCE": {"label": "BTS Commerce", "cycle": "bts", "years": 2},
    "BTS_ELECTRO": {"label": "BTS Électrotechnique", "cycle": "bts", "years": 2},

    # Santé
    "MED_1": {"label": "Médecine 1ère année (PCEM1)", "cycle": "sante", "high_stakes": True},
    "MED_2": {"label": "Médecine 2ème année", "cycle": "sante"},
    "PHARMA": {"label": "Pharmacie", "cycle": "sante"},
    "INFIRMIER": {"label": "Infirmier(ère)", "cycle": "paramedical"},

    # Droit & Économie
    "DROIT_L1": {"label": "Droit Licence 1", "cycle": "droit"},
    "DROIT_M": {"label": "Master Droit", "cycle": "droit"},
    "ECO_L1": {"label": "Économie Licence 1", "cycle": "economie"},
}

SUPERIEUR_QUESTION_TYPES = {
    "licence": ["essay", "open_calculation", "document_analysis", "mcq_single"],
    "master": ["essay", "case_study", "oral_question", "document_analysis"],
    "cpge": ["open_calculation", "proof", "oral_question"],
    "grande_ecole": ["case_study", "open_calculation", "essay", "oral_question"],
    "bts": ["open_calculation", "document_analysis", "essay", "mcq_single"],
    "sante": ["mcq_single", "clinical_case", "open_calculation"],
    "droit": ["essay", "case_juridique", "document_analysis"],
}

# Moroccan university exam formats
SUPERIEUR_EXAM_FORMATS = {
    "controle_continu": {
        "label": "Contrôle Continu",
        "weight": 0.40,
        "types": ["mcq_single", "fill_blank", "open_calculation"],
        "duration_minutes": 60,
    },
    "examen_semestre": {
        "label": "Examen Semestriel",
        "weight": 0.60,
        "types": ["essay", "open_calculation", "document_analysis"],
        "duration_minutes": 120,
    },
    "rattrapage": {
        "label": "Session de Rattrapage",
        "weight": 1.0,
        "notes": "Second chance exam. Same format as Examen Semestriel.",
        "duration_minutes": 120,
    },
}
```

### University-specific question generators

Add to `exam_service.py`:

```python
def _build_university_prompt(context, count, subject, level, question_type, language):
    level_notes = {
        "L1": "introductory level — focus on understanding core concepts",
        "L2": "intermediate — include application of concepts",
        "L3": "advanced — require synthesis and critical analysis",
        "M1": "master level — require independent argumentation",
        "M2": "research-oriented — require critical evaluation of literature",
        "CPGE": "competitive exam level — rigorous mathematical/scientific reasoning",
    }
    note = level_notes.get(level, "university level")

    if question_type == "case_study":
        return _build_university_case_study(context, count, subject, note, language)
    elif question_type == "oral_question":
        return _build_oral_question(context, count, note, language)
    elif question_type == "clinical_case":
        return _build_clinical_case(context, count, language)
    elif question_type == "case_juridique":
        return _build_legal_case(context, count, language)
    else:
        return _build_standard_prompt(context, count, question_type, "hard", language)


def _build_clinical_case(context, count, language):
    """Medical/health case study — patient scenario with diagnostic questions."""
    return (
        f"Generate {count} clinical case(s) for Moroccan medical/health students.\n\n"
        "Each clinical case must have:\n"
        '- "presentation": patient case (age, sex, chief complaint, history, vitals, key findings)\n'
        '- "questions": 3-4 questions about diagnosis, pathophysiology, treatment, monitoring\n'
        '- "answers": model answers for each question\n'
        '- "key_learning_points": 3 clinical pearls from this case\n'
        '- "differential_diagnosis": 2-3 other conditions to rule out\n\n'
        "The case must be realistic for Moroccan clinical context (prevalence of diseases in Morocco).\n"
        "Use standard medical terminology. Write in French unless Arabic is specified.\n\n"
        f"COURSE MATERIAL:\n{context[:3000]}"
    )


def _build_legal_case(context, count, language):
    """Legal case analysis for law students — Moroccan law context."""
    return (
        f"Generate {count} cas juridique(s) pour des étudiants en droit marocain.\n\n"
        "Chaque cas doit contenir:\n"
        '- "faits": les faits de l\'espèce (situation réelle fictive)\n'
        '- "questions": 2-3 questions juridiques (qualification, règles applicables, solution)\n'
        '- "reponses_modeles": réponse détaillée avec référence aux textes de loi marocains\n'
        '- "textes_applicables": liste des articles de loi pertinents (Code civil, Code pénal, etc.)\n'
        '- "jurisprudence": référence à une jurisprudence marocaine si disponible dans le matériel\n\n'
        "Le cas doit être ancré dans le droit marocain (Code des Obligations et Contrats, Moudawwana, etc.).\n\n"
        f"MATIÈRE:\n{context[:3000]}"
    )
```

### University essay rubrics

Add to `grading_service.py` `ESSAY_RUBRIC_CATEGORIES`:

```python
# Dissertation juridique (law — Moroccan style)
"dissertation_juridique": [
    {"category": "introduction_annonce_plan", "max_points": 4,
     "description": "Accroche, définition des termes, problématique, annonce du plan en deux parties."},
    {"category": "partie1_developpement", "max_points": 6,
     "description": "Première partie avec deux sous-parties. Arguments, exemples, articulation."},
    {"category": "partie2_developpement", "max_points": 6,
     "description": "Deuxième partie avec deux sous-parties. Arguments, exemples, articulation."},
    {"category": "conclusion", "max_points": 2,
     "description": "Bilan, réponse à la problématique, ouverture."},
    {"category": "langue_style_juridique", "max_points": 2,
     "description": "Vocabulaire juridique précis, construction des phrases, orthographe."},
],

# Rapport de stage / mémoire (internship report / thesis)
"rapport_memoire": [
    {"category": "problematique_objectifs", "max_points": 4,
     "description": "La problématique est clairement définie et les objectifs sont SMART."},
    {"category": "revue_litterature", "max_points": 4,
     "description": "Les sources sont pertinentes, récentes et correctement citées."},
    {"category": "methodologie", "max_points": 4,
     "description": "La démarche méthodologique est rigoureuse et justifiée."},
    {"category": "analyse_resultats", "max_points": 5,
     "description": "L'analyse est critique, les résultats sont interprétés correctement."},
    {"category": "recommandations", "max_points": 3,
     "description": "Les recommandations sont concrètes, réalisables et argumentées."},
],
```

---

## Part 2 — Formation Professionnelle (OFPPT)

The OFPPT (Office de la Formation Professionnelle et de la Promotion du Travail)
is the main vocational training body in Morocco. It has a specific structure.

Add to `curriculum_service.py`:

```python
OFPPT_LEVELS = {
    # Niveau Spécialisation (post-primary, no Bac required)
    "SPEC": {
        "label": "Niveau Spécialisation",
        "entry": "Après la 9ème année",
        "duration": "1 an",
        "sectors": ["agriculture", "artisanat", "batiment"],
    },
    # Niveau Qualification (post-collège)
    "QUAL": {
        "label": "Niveau Qualification",
        "entry": "Brevet ou 3AC",
        "duration": "1-2 ans",
        "sectors": ["commerce", "informatique", "maintenance", "electricite"],
    },
    # Niveau Technicien (post-Bac possible)
    "TECH": {
        "label": "Niveau Technicien",
        "entry": "Bac ou équivalent",
        "duration": "2 ans",
        "sectors": ["informatique", "gestion", "electronique", "mecanique", "tourisme"],
    },
    # Niveau Technicien Spécialisé (Bac+2 equivalent)
    "TS": {
        "label": "Technicien Spécialisé (Bac+2)",
        "entry": "Bac",
        "duration": "2 ans",
        "sectors": [
            "developpement_digital", "reseaux_telecoms", "gestion_entreprise",
            "commerce_international", "hotellerie_restauration", "logistique",
            "maintenance_industrielle", "energies_renouvelables",
        ],
        "high_stakes": True,
        "exam": "Examen de Fin de Formation (EFF)",
    },
}

OFPPT_SECTORS = {
    "developpement_digital": {
        "label": "Développement Digital",
        "subjects": ["programmation", "base_de_donnees", "web", "mobile", "reseaux"],
        "practical_weight": 0.40,  # 40% practical exam
    },
    "reseaux_telecoms": {
        "label": "Réseaux et Télécommunications",
        "subjects": ["cisco", "linux", "securite", "telephonie_ip", "fibre_optique"],
        "practical_weight": 0.50,
    },
    "gestion_entreprise": {
        "label": "Gestion des Entreprises et des Administrations",
        "subjects": ["comptabilite", "gestion_rh", "marketing", "droit_commercial", "fiscalite"],
        "practical_weight": 0.30,
    },
    "commerce_international": {
        "label": "Commerce International",
        "subjects": ["techniques_commerce_ext", "douane", "transport", "assurance", "langues"],
        "practical_weight": 0.35,
    },
    "hotellerie_restauration": {
        "label": "Hôtellerie et Restauration",
        "subjects": ["cuisine", "service_salle", "reception", "hygiene", "gestion_hotel"],
        "practical_weight": 0.60,
    },
    "maintenance_industrielle": {
        "label": "Maintenance Industrielle",
        "subjects": ["mecanique", "hydraulique", "electrotechnique", "automatismes", "pneumatique"],
        "practical_weight": 0.55,
    },
    "energies_renouvelables": {
        "label": "Énergies Renouvelables",
        "subjects": ["solaire_photovoltaique", "eolien", "installation_maintenance", "electricite"],
        "practical_weight": 0.50,
    },
}

# OFPPT EFF exam format
EFF_FORMAT = {
    "label": "Examen de Fin de Formation",
    "parts": [
        {"name": "Théorie", "weight": 0.40, "types": ["mcq_single", "open_calculation", "fill_blank"]},
        {"name": "Pratique", "weight": 0.60, "types": ["practical_scenario", "technical_case"]},
    ],
    "total_points": 20,
    "passing_score": 12,  # 12/20 to pass
}
```

### OFPPT-specific question type

Add to `exam_service.py`:

```python
def _build_practical_scenario_prompt(context, count, sector, language):
    """Practical scenario for OFPPT technical students."""
    sector_context = {
        "developpement_digital": "The student works as a developer in a Moroccan company.",
        "gestion_entreprise": "The student works in the accounting/HR department of a Moroccan SME.",
        "hotellerie_restauration": "The student works in a hotel or restaurant.",
        "maintenance_industrielle": "The student works as a technician in an industrial facility.",
    }.get(sector, "The student works in a Moroccan professional setting.")

    return (
        f"Generate {count} practical scenario(s) for OFPPT {sector} students.\n\n"
        f"Context: {sector_context}\n\n"
        "Each scenario must:\n"
        "- Describe a realistic workplace situation encountered in Morocco\n"
        "- Ask the student to perform a specific technical task or solve a problem\n"
        "- Have a clear, verifiable expected outcome\n"
        "- Include the tools/resources available to the student\n\n"
        "Format:\n"
        '- "situation": workplace scenario description\n'
        '- "task": what the student must do (specific, measurable)\n'
        '- "resources_available": tools, software, documents available\n'
        '- "expected_output": what a correct solution looks like\n'
        '- "evaluation_criteria": how the work will be judged (rubric)\n'
        '- "time_allocated_minutes": realistic time for this task\n\n'
        f"COURSE MATERIAL:\n{context[:3000]}"
    )
```

---

## Part 3 — Frontend: level selector for all Moroccan levels

Update `UniversalLevelSelector` in `apps/web/components/shared/LevelSelector.tsx`
to show all Moroccan education levels:

```tsx
const MOROCCAN_FULL_SYSTEM = [
  {
    cycle: "Préscolaire",
    emoji: "🧒",
    levels: [{ code: "PRESCOLAIRE", label: "Maternelle / روضة" }],
  },
  {
    cycle: "Primaire — ابتدائي",
    emoji: "📚",
    levels: [
      { code: "1AP", label: "1ère AP" }, { code: "2AP", label: "2ème AP" },
      { code: "3AP", label: "3ème AP" }, { code: "4AP", label: "4ème AP" },
      { code: "5AP", label: "5ème AP" }, { code: "6AP", label: "6ème AP (CEP)" },
    ],
  },
  {
    cycle: "Collège — إعدادي",
    emoji: "🏫",
    levels: [
      { code: "1AC", label: "1AC" }, { code: "2AC", label: "2AC" },
      { code: "3AC", label: "3AC (Brevet)" },
    ],
  },
  {
    cycle: "Lycée — تأهيلي",
    emoji: "🎒",
    levels: [
      { code: "TC_S", label: "TC Sciences" }, { code: "TC_L", label: "TC Lettres" },
      { code: "1BAC_SE", label: "1BAC Sc.Exp" }, { code: "1BAC_SM", label: "1BAC Sc.Math" },
      { code: "1BAC_SEG", label: "1BAC SEG" },
      { code: "2BAC_SE", label: "2BAC Sc.Exp" }, { code: "2BAC_SM_A", label: "2BAC SM A" },
      { code: "2BAC_SM_B", label: "2BAC SM B" }, { code: "2BAC_SEG", label: "2BAC SEG" },
      { code: "2BAC_SH", label: "2BAC Sc.Hum" }, { code: "2BAC_L", label: "2BAC Lettres" },
    ],
  },
  {
    cycle: "Université — جامعة",
    emoji: "🎓",
    levels: [
      { code: "L1", label: "L1 (Bac+1)" }, { code: "L2", label: "L2" },
      { code: "L3", label: "L3" }, { code: "M1", label: "M1" },
      { code: "M2", label: "M2" }, { code: "DOCTORAT", label: "Doctorat" },
      { code: "MED_1", label: "Médecine" }, { code: "DROIT_L1", label: "Droit" },
    ],
  },
  {
    cycle: "Grandes Écoles",
    emoji: "🏛️",
    levels: [
      { code: "CPGE_MP", label: "CPGE MP" }, { code: "CPGE_PC", label: "CPGE PC" },
      { code: "ENSA", label: "ENSA" }, { code: "ENCG", label: "ENCG" },
      { code: "ENSIAS", label: "ENSIAS" }, { code: "BTS_INFO", label: "BTS Info" },
    ],
  },
  {
    cycle: "Formation Pro — OFPPT",
    emoji: "🔧",
    levels: [
      { code: "SPEC", label: "Spécialisation" }, { code: "QUAL", label: "Qualification" },
      { code: "TECH", label: "Technicien" }, { code: "TS", label: "Technicien Spécialisé" },
    ],
  },
]
```

When a user selects an OFPPT level, show a second dropdown:
```tsx
{selectedLevel?.startsWith("TS") || selectedLevel === "TECH" ? (
  <div>
    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
      Filière / Secteur
    </label>
    <div className="flex flex-wrap gap-2">
      {Object.entries(OFPPT_SECTORS).map(([code, sector]) => (
        <button
          key={code}
          onClick={() => setSector(code)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
            selectedSector === code
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
          }`}
        >
          {sector.label}
        </button>
      ))}
    </div>
  </div>
) : null}
```

---

## Verification

```bash
python -c "
from app.services.curriculum_service import (
    SUPERIEUR_LEVELS, OFPPT_LEVELS, OFPPT_SECTORS, EFF_FORMAT, PRIMAIRE_LEVELS
)

all_levels = list(PRIMAIRE_LEVELS.keys()) + list(SUPERIEUR_LEVELS.keys()) + list(OFPPT_LEVELS.keys())
print(f'Total Moroccan levels: {len(all_levels)}')
print(f'OFPPT sectors: {list(OFPPT_SECTORS.keys())}')
print(f'EFF passing score: {EFF_FORMAT[\"passing_score\"]}/20')
print('All Moroccan levels: OK')
"
```
