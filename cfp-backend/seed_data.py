"""
seed_data.py — Pure sample-data module, no imports beyond stdlib.

Kept separate from both database.py and seed.py so both can import the
same SEED_CFPS list without a circular import:
    database.py  -> imports SEED_CFPS (for auto-seed-on-empty-DB)
    seed.py       -> imports SEED_CFPS (for the manual `python seed.py` script)

Deadlines are stored as day-offsets-from-today so they're always realistic
relative to whenever the app actually starts, rather than hardcoded dates
that would eventually all read as "Closed".
"""

# Each entry: (title, organization, email, days_from_today, listing_type, content, category_slugs)
SEED_CFPS = [
    (
        "Unmaking the Canon: Marginalized Voices in Victorian Literature",
        "Victorian Studies Association",
        "vstudies@bu.edu",
        60,
        "Journal",
        """We invite submissions for a special issue of Victorian Margins exploring how contemporary scholarship can reframe the Victorian literary canon by centering voices historically excluded from academic attention.

Topics may include: women's periodical writing, working-class autobiography, colonial literatures in English, disability and the Victorian body, queer readings of canonical texts, and the material conditions of literary production.

Papers of 6,000–8,000 words. Abstracts of 300 words due by deadline. Please submit via the journal portal and direct questions to the editors at the address above.""",
        ["victorian", "gender-studies-and-sexuality", "postcolonial"],
    ),
    (
        "Algorithms and the Imagination: AI in Contemporary Fiction",
        "Science Fiction Research Association",
        "sfra2026@sfra.org",
        45,
        "Conference",
        """The Science Fiction Research Association invites papers for its 2026 annual conference exploring how contemporary literary fiction has responded to — and anticipated — the rise of artificial intelligence.

We welcome approaches from cognitive science, media studies, philosophy of mind, postcolonial theory, and beyond. Panels, individual papers, and roundtable proposals all considered.

Abstracts: 250 words. Full panels: 500-word overview plus individual abstracts. The conference will be held in Austin, TX, October 9–12, 2026.""",
        ["science-and-culture", "humanities-computing-and-the-internet", "twentieth-century-and-beyond"],
    ),
    (
        "Graduate Symposium on Translation Across Media",
        "Comparative Literature Program, University of Michigan",
        "complitstudents@umich.edu",
        22,
        "Conference",
        """This one-day graduate symposium invites papers from graduate students at any stage of their program on the theory and practice of translation — understood broadly to include linguistic translation, adaptation, remediation, and cross-media transposition.

Keynote by Prof. Emily Apter (NYU). Travel stipends available for accepted participants outside the Ann Arbor area.

250-word abstracts due by deadline. Notification of acceptance within three weeks.""",
        ["translation-studies", "graduate-conferences", "interdisciplinary"],
    ),
    (
        "Staging Disability: Theatre, Access, and Representation",
        "Theatre Topics",
        "theatretopics@jhu.edu",
        75,
        "Journal",
        """Theatre Topics seeks articles for a themed issue on disability in contemporary theatre and performance. We are particularly interested in work that moves beyond representation to examine access, crip aesthetics, and the relationship between performance and disability justice movements.

We welcome contributions from scholars, practitioners, and artist-scholars. Creative-critical hybrid formats considered. 5,000–7,000 words.""",
        ["theatre-and-performance-studies", "gender-studies-and-sexuality", "pedagogy"],
    ),
    (
        "Romanticism and the Anthropocene",
        "North American Society for the Study of Romanticism",
        "nassr2026@colorado.edu",
        55,
        "Conference",
        """NASSR 2026 invites papers and panels on any aspect of British and European Romanticism, with special interest this year in ecocritical approaches, climate and catastrophe, and what Romantic-era texts can teach us about ecological crisis.

Hosted at the University of Colorado Boulder, August 14–17, 2026. Individual abstracts (250 words) and panel proposals (750 words + individual abstracts) welcome. Graduate student prize for best paper.""",
        ["romantic", "ecocriticism-and-environmental-studies", "theory"],
    ),
    (
        "Call for Book Reviews: Postcolonial Feminisms",
        "Journal of Commonwealth and Postcolonial Studies",
        "jcps@uga.edu",
        30,
        "Journal",
        """The Journal of Commonwealth and Postcolonial Studies seeks reviewers for recent titles in postcolonial feminist theory and literature. We are assembling a review roundtable for our Fall 2026 issue.

Books under consideration include recent titles spanning South Asian feminisms, African feminist thought, and Caribbean women's writing. Review essays of 1,500–2,500 words.""",
        ["postcolonial", "gender-studies-and-sexuality", "world-literatures-and-indigenous-studies"],
    ),
    (
        "Medieval Ecocriticism: Land, Water, and the More-Than-Human",
        "New Chaucer Society",
        "ncs-cfp@medievalstudies.org",
        90,
        "Conference",
        """The New Chaucer Society biennial congress invites paper proposals on all aspects of medieval literature and culture, with a special strand this year on ecocritical and posthumanist approaches to the medieval world.

We are especially interested in work on medieval relationships to land, water, animals, and the broader ecology of the pre-modern imagination. The congress meets in Oxford, July 12–16, 2026.""",
        ["medieval", "ecocriticism-and-environmental-studies", "interdisciplinary"],
    ),
    (
        "Pedagogies of Resistance: Teaching Difficult Histories",
        "National Council of Teachers of English",
        "research@ncte.org",
        40,
        "Conference",
        """NCTE invites proposals for its annual convention exploring innovative and critical approaches to teaching literature and composition. This year's theme centers on how educators navigate difficult, contested, and traumatic histories in the classroom.

Individual presentations (20 min), panels (75 min), and workshops (90 min). Convention dates: November 19–22, 2026, Chicago, IL.""",
        ["pedagogy", "rhetoric-and-composition", "american"],
    ),
    (
        "Fan Labor, Platform Capitalism, and the Future of Fandom",
        "Transformative Works and Cultures",
        "twc-submissions@transformativeworks.org",
        35,
        "Journal",
        """Transformative Works and Cultures invites submissions for a special issue on the political economy of fan labor in an era of platform capitalism.

Topics may include: monetization and the professionalization of fan production, algorithmic curation of fan content, and the racial and gendered dimensions of fan labor. 5,000–8,000 words.""",
        ["fan-studies-and-fandom", "popular-culture", "cultural-studies-and-historical-approaches"],
    ),
    (
        "American Literature and the Archive: New Approaches",
        "American Literature Association",
        "ala-cfp@americanliterature.org",
        50,
        "Conference",
        """The American Literature Association 2026 Symposium invites papers exploring the relationship between American literary scholarship and archival practice.

We are particularly interested in proposals addressing digital archives, community archives, and the politics of what gets preserved. Held in Boston, MA, May 22–25, 2026.""",
        ["american", "bibliography-and-history-of-the-book", "interdisciplinary"],
    ),
    (
        "Poetry and the Climate Emergency",
        "Poetry Foundation Research Initiative",
        "research@poetryfoundation.org",
        28,
        "Journal",
        """Poetry magazine and the Poetry Foundation Research Initiative invite scholarly essays on contemporary poetry's engagement with climate change, ecological crisis, and the Anthropocene.

Essays of 4,000–6,000 words. Shorter interventions of 1,500–2,500 words also welcome for our criticism section.""",
        ["poetry", "ecocriticism-and-environmental-studies", "twentieth-century-and-beyond"],
    ),
    (
        "New Horizons in Renaissance Drama",
        "Marlowe Society of America",
        "cfp@marlowesociety.org",
        65,
        "Conference",
        """The Marlowe Society of America invites proposals for its 2026 conference on Renaissance drama, with an open call across all topics and a special focus on performance histories and staging practices.

Conference held at Folger Shakespeare Library, Washington DC, April 3–5, 2026. Fellowship funding available for non-local graduate presenters.""",
        ["renaissance", "theatre-and-performance-studies", "graduate-conferences"],
    ),
    (
        "World Literature in the Age of Decolonization",
        "PMLA — Publications of the Modern Language Association",
        "pmla@mla.org",
        80,
        "Journal",
        """PMLA invites essays for a special forum on world literature and decolonization, examining how the frameworks through which we read, teach, and canonize world literature can be transformed by decolonial theory and practice.

Essays of 6,000–8,500 words. Submissions due by the deadline; decisions within four months.""",
        ["world-literatures-and-indigenous-studies", "postcolonial", "theory"],
    ),
    (
        "Online Symposium: Modernism, Race, and Transatlantic Exchange",
        "Modernist Studies Association — Digital Programming Committee",
        "msa-digital@modernist-studies.org",
        18,
        "Conference",
        """The MSA Digital Programming Committee invites proposals for a free online half-day symposium on modernism, race, and transatlantic cultural exchange.

This online-only event aims to be maximally accessible. Abstracts of 200 words. Presentations 15 minutes with 10 minutes of Q&A. Recordings made available on the MSA website.""",
        ["modernist-studies", "online-conferences", "african-american"],
    ),
    (
        "The Rhetoric of Conspiracy: Language, Belief, and Public Discourse",
        "Rhetoric Society of America",
        "rsa2026@rhetoricsociety.org",
        42,
        "Conference",
        """The Rhetoric Society of America invites papers for its 2026 biennial conference exploring the rhetoric of conspiracy theories and their role in contemporary public discourse.

Paper abstracts (300 words), panel proposals, and pre-conference workshop proposals welcome. Conference held in Denver, CO, May 28–31, 2026.""",
        ["rhetoric-and-composition", "cultural-studies-and-historical-approaches", "professional-topics"],
    ),
]
