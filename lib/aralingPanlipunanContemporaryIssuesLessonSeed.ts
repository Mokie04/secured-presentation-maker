import type { ImageSemanticMetadata, LessonBlueprint, Presentation, Slide } from '../types';

type CachedLessonPlanSeed = {
  blueprint: LessonBlueprint;
  initialPresentation: Presentation;
};

const AP_CONTEMPORARY_ISSUES_TOPIC = 'Kahalagahan ng Kaalaman sa mga Kontemporanyong Isyu';
const AP_CONTEMPORARY_ISSUES_COMPETENCY = 'Natatalakay ang kahalagahan ng kaalaman sa mga kontemporanyong isyu.';

const AP_CONTEMPORARY_ISSUES_OBJECTIVES = [
  'Sa katapusan ng Sesyon 1, nailalarawan at naipaliliwanag ng mga mag-aaral ang mahahalagang konsepto, datos, at tanong tungkol sa kahalagahan ng kaalaman sa mga kontemporanyong isyu gamit ang mapa, grapiko, larawan, o maikling sanggunian bilang ebidensiya, hindi lamang personal na opinyon.',
  'Sa katapusan ng Sesyon 2, nasusuri ng mga mag-aaral ang sanhi, bunga, ugnayan, pattern, o pagbabago na nagpapaliwanag sa kahalagahan ng kaalaman sa mga kontemporanyong isyu gamit ang organizer at hindi lamang listahan ng impormasyon.',
  'Sa katapusan ng Sesyon 3, naiuugnay ng mga mag-aaral ang kahalagahan ng kaalaman sa mga kontemporanyong isyu sa karanasan ng tao, pamayanan, bansa, o daigdig gamit ang perspektiba, pagpapahalaga, at maingat na paghatol na may ebidensiya.',
  'Sa katapusan ng Sesyon 4, nakabubuo ang mga mag-aaral ng pagsusuri ng kontemporanyong isyu at panukalang aksiyon tungkol sa kahalagahan ng kaalaman sa mga kontemporanyong isyu na may malinaw na claim, sapat na ebidensiya, paliwanag ng kahalagahan, at maingat na pananaw.',
];

const apContemporaryIssuesBlueprint: LessonBlueprint = {
  mainTitle: AP_CONTEMPORARY_ISSUES_TOPIC,
  planUnitLabel: 'Session',
  subject: 'Araling Panlipunan',
  gradeLevel: 'Grade 10',
  quarter: 'Unang Markahan',
  learningCompetency: AP_CONTEMPORARY_ISSUES_COMPETENCY,
  smartObjectives: [...AP_CONTEMPORARY_ISSUES_OBJECTIVES],
  studentFacingObjectives: [
    'Gumamit ng ebidensiya bago bumuo ng paliwanag.',
    'Iugnay ang sanhi, bunga, at kahalagahan ng isyu.',
    'Tingnan ang isyu mula sa iba-ibang perspektiba.',
    'Bumuo ng malinaw na pagsusuri at panukalang aksiyon.',
  ],
  days: [
    {
      dayNumber: 1,
      title: 'Ebidensiya Bago Opinyon',
      focus: 'Learners separate evidence, inference, and unanswered questions before explaining why contemporary issues matter.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 2,
      title: 'Sanhi, Bunga, at Ugnayan',
      focus: 'Learners build a source-supported relationship map that explains cause, effect, pattern, change, or significance.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 3,
      title: 'Perspektiba at Pamantayan',
      focus: 'Learners analyze stakeholder perspectives and use criteria to make careful evidence-based judgments.',
      generationStatus: 'pending',
    },
    {
      dayNumber: 4,
      title: 'Pagsusuri at Panukalang Aksiyon',
      focus: 'Learners produce a source-supported issue analysis and action proposal, then revise using peer feedback.',
      generationStatus: 'pending',
    },
  ],
};

const baseMetadata = {
  level: 'k12',
  format: 'K-12',
  subject: 'araling-panlipunan-contemporary-issues',
  topic: AP_CONTEMPORARY_ISSUES_TOPIC,
  gradeLevel: 'Grade 10',
  gradeBand: '7-10',
  learningCompetency: AP_CONTEMPORARY_ISSUES_COMPETENCY,
  language: 'FIL' as const,
};

const metadataFor = (
  semanticAnchor: string,
  slideTemplate: string,
  visualRole: string,
  style: ImageSemanticMetadata['style'] = 'photorealistic',
): ImageSemanticMetadata => ({
  ...baseMetadata,
  visualRole,
  slideTemplate,
  semanticAnchor,
  style,
});

const slide = (
  title: string,
  content: string[],
  speakerNotes: string,
  imagePrompt = '',
  semanticAnchor = '',
  slideTemplate = 'content',
  visualRole = 'content',
  visualLayout?: Slide['visualLayout'],
): Slide => ({
  title,
  content,
  speakerNotes,
  imagePrompt,
  imageStyle: imagePrompt ? 'photorealistic' : 'none',
  ...(imagePrompt ? { imageSemanticMetadata: metadataFor(semanticAnchor, slideTemplate, visualRole) } : {}),
  ...(visualLayout ? { visualLayout } : {}),
});

const evidenceSlide = (
  title: string,
  content: string[],
  speakerNotes: string,
  imagePrompt: string,
  semanticAnchor: string,
  slideTemplate = 'content',
  visualRole = 'content',
): Slide => slide(title, content, speakerNotes, imagePrompt, semanticAnchor, slideTemplate, visualRole, 'evidence');

const initialSlides: Slide[] = [
  evidenceSlide(
    AP_CONTEMPORARY_ISSUES_TOPIC,
    ['Asignatura: Araling Panlipunan', 'Baitang: Grade 10', 'Markahan: Unang Markahan', 'Linggo 1: Ebidensiya, ugnayan, perspektiba, at aksiyon'],
    'Ipakilala ang buong linggo bilang pagsasanay sa pag-iisip na may batayan: hindi sapat ang opinyon; kailangan ang ebidensiya, ugnayan, perspektiba, at malinaw na aksiyon.',
    'Photorealistic Philippine Grade 10 classroom evidence-analysis scene with source cards, map, chart sheets, and students comparing evidence before forming an opinion, no readable text.',
    'source-evidence-analysis',
    'concept',
    'source-evidence',
  ),
  slide(
    'Roadmap ng Linggo',
    ['Sesyon 1: ebidensiya bago hinuha', 'Sesyon 2: sanhi, bunga, at ugnayan', 'Sesyon 3: perspektiba at pamantayan', 'Sesyon 4: pagsusuri at panukalang aksiyon'],
    `Gamitin ito bilang student-facing roadmap. Ang opisyal na layunin ay nakaangkla sa kompetensi: ${AP_CONTEMPORARY_ISSUES_COMPETENCY}`,
  ),
  evidenceSlide(
    'Paano Magiging Matibay ang Paliwanag?',
    ['May malinaw na claim.', 'May source detail.', 'May paliwanag ng ugnayan.', 'May paggalang sa perspektiba.'],
    'Itakda ang pamantayan ng linggo. Ipaalala na ang kontemporanyong isyu ay kailangang suriin, hindi lamang pag-usapan.',
    'Photorealistic classroom civic action planning workspace with blank claim evidence explanation cards, peer review checklist, and students preparing an action proposal, no readable text.',
    'civic-action-planning',
    'assignment',
    'civic-action',
  ),
];

const sessionSlides: Record<number, Slide[]> = {
  1: [
    evidenceSlide(
      'Bakit Ebidensiya Muna?',
      ['Tingnan muna ang source.', 'Ihiwalay ang datos at hinuha.', 'Magtanong bago humatol.', 'Ipaliwanag kung bakit mahalaga.'],
      'Buksan ang sesyon sa tanong: Ano ang masasabi natin nang may batayan, at alin ang hinuha pa lamang? Iugnay sa layunin ng Sesyon 1.',
      'Photorealistic Philippine Grade 10 classroom evidence-analysis scene with source cards, map, chart sheets, and students comparing evidence before forming an opinion, no readable text.',
      'source-evidence-analysis',
      'concept',
      'source-evidence',
    ),
    slide(
      'Target ng Sesyon 1',
      ['Makakita ng ebidensiya.', 'Magtala ng hinuha.', 'Bumuo ng tanong.', 'Ipaliwanag ang halaga ng source.'],
      `Opisyal na layunin: ${AP_CONTEMPORARY_ISSUES_OBJECTIVES[0]} Panatilihing learner-facing ang slide; gamitin ang buong layunin sa paliwanag ng guro.`,
    ),
    slide(
      'Paunang Hinuha: Tatlong Hanay',
      ['Ebidensiya: ano ang nakikita?', 'Hinuha: ano ang iniisip?', 'Tanong: ano ang kulang?', 'Source: saan galing ang batayan?'],
      'Gamitin ang larawan, mapa, graph, sipi, o sitwasyon mula sa lesson plan. Iwasang papuntahin agad ang klase sa opinyon; unahin ang obserbasyon.',
    ),
    slide(
      'Pangunahing Gawain: Source Readiness',
      ['Basahin ang maikling sanggunian.', 'Itala ang dalawang datos.', 'Tukuyin ang isang pattern.', 'Isulat ang isang tanong na hindi pa kayang sagutin.'],
      'Ito ang pangunahing gawain ng Sesyon 1. Output: source notes na may datos, pattern, posibleng sanhi o epekto, at tanong na kailangang patunayan pa.',
    ),
    slide(
      'Kapag Walang Source',
      ['Mahina ang claim.', 'Mabilis maging generalization.', 'Hindi malinaw ang dahilan.', 'Mahirap ipagtanggol ang paliwanag.'],
      'I-modelo ang isang mahinang pahayag at ipakita kung bakit hindi sapat ang personal na opinyon sa Araling Panlipunan.',
    ),
    evidenceSlide(
      'PEP Note',
      ['Pahayag: ano ang claim?', 'Ebidensiya: anong source detail?', 'Paliwanag: bakit mahalaga?', 'Tanong: ano pa ang kailangan?'],
      'Gumawa ang pares ng PEP note. I-check kung ang ebidensiya ay mismong detalye mula sa source at hindi lamang palagay.',
      'Photorealistic Grade 10 media literacy source reliability check scene with students sorting blank source cards and evidence notes, tablets turned away or blurred, no readable text.',
      'source-reliability-check',
      'practice',
      'media-literacy',
    ),
    slide(
      'Debrief',
      ['Aling detalye ang pinakamalinaw?', 'Aling hinuha ang kailangang patunayan?', 'Ano ang nagbago sa unang sagot?', 'Bakit mas patas ang paliwanag ngayon?'],
      'Gamitin ang debrief upang palakasin ang distinction ng ebidensiya, hinuha, tanong, at konklusyon.',
    ),
    slide(
      'Exit Slip',
      ['Isang claim na may source detail.', 'Isang paliwanag ng kahalagahan.', 'Isang tanong para sa susunod.', 'Isang hinuha na irerebisa.'],
      'Kolektahin ang exit slip bilang formative evidence para sa susunod na sesyon. Hanapin kung sino ang umaasa pa rin sa opinion-only claim.',
    ),
  ],
  2: [
    evidenceSlide(
      'Bakit Hindi Sapat ang Listahan?',
      ['Hanapin ang sanhi.', 'Tukuyin ang bunga.', 'Iugnay ang datos.', 'Ipaliwanag ang kahalagahan.'],
      'Buksan ang Sesyon 2 sa pagkakaiba ng listahan at pagsusuri. Ang layunin ay makita ang ugnayan ng mga salik gamit ang organizer.',
      'Photorealistic classroom issue mapping scene with Filipino Grade 10 students arranging blank cause effect stakeholder cards, source photos, and colored notes, no readable text.',
      'cause-effect-stakeholder-map',
      'activity',
      'issue-analysis',
    ),
    slide(
      'Target ng Sesyon 2',
      ['Balikan ang source notes.', 'Pumili ng mahalagang datos.', 'Gumawa ng relationship map.', 'Magdagdag ng significance statement.'],
      `Opisyal na layunin: ${AP_CONTEMPORARY_ISSUES_OBJECTIVES[1]} Ituon ang presentasyon sa ugnayan, hindi sa pagkopya ng impormasyon.`,
    ),
    slide(
      'Balik sa Ebidensiya',
      ['Aling datos ang pinakamahalaga?', 'Sanhi ba ito?', 'Bunga ba ito?', 'Nagpapakita ba ito ng pagbabago?'],
      'Ipa-review ang source notes mula Sesyon 1. Ipasabi kung ang datos ay sanhi, epekto, pagbabago, paghahambing, o kahalagahan.',
    ),
    slide(
      'Pangunahing Gawain: Relationship Map',
      ['Ilagay ang isyu sa gitna.', 'Ikabit ang sanhi at bunga.', 'Lagyan ng source detail ang bawat arrow.', 'Markahan ang hinuha na kailangan pa ng patunay.'],
      'Ito ang pangunahing gawain ng Sesyon 2. Output: relationship map na may source-supported links at malinaw na paliwanag ng bawat arrow.',
    ),
    slide(
      'Tanong ng Kapares',
      ['Aling arrow ang pinakamatibay?', 'Aling arrow ang hinuha pa lamang?', 'Anong source ang kulang?', 'Paano lalakas ang paliwanag?'],
      'Magpalitan ng mapa ang mga pangkat. Iwasan ang feedback na "maganda" o "kulang" lamang; dapat nakatali sa ebidensiya at ugnayan.',
    ),
    evidenceSlide(
      'Source-Supported Links',
      ['Claim sa gitna.', 'Arrow na may paliwanag.', 'Source detail sa tabi.', 'Significance sa dulo.'],
      'I-modelo kung paano gawing synthesis ang relationship map. Bigyang-diin na ang arrow ay kailangang may paliwanag, hindi dekorasyon.',
      'Photorealistic classroom table with students arranging cause effect cards, blank relationship map, source photos, and colored markers, no readable text.',
      'cause-effect-stakeholder-map',
      'activity',
      'issue-analysis',
    ),
    slide(
      'Mabilisang Pagtataya',
      ['Mahalagang suriin ang isyu dahil...', 'Gamitin ang isang source detail.', 'Gumamit ng relationship word.', 'Ipaliwanag ang epekto sa tao o pamayanan.'],
      'Ipasagot ang quick check mula sa lesson plan. Hanapin ang paggamit ng sanhi, bunga, nagbago, humantong, o nakaapekto.',
    ),
    slide(
      'Exit Slip',
      ['Isang matibay na ugnayan.', 'Isang mahinang ugnayan.', 'Isang source na kailangan pa.', 'Isang binagong paliwanag.'],
      'Kolektahin ang exit slip bilang batayan kung kailangang mag-model muli ng cause-effect, comparison, o source-supported explanation.',
    ),
  ],
  3: [
    evidenceSlide(
      'Sino ang Apektado?',
      ['Tukuyin ang grupo.', 'Alamin ang interes.', 'Tingnan ang limitasyon.', 'Humusga gamit ang pamantayan.'],
      'Buksan ang Sesyon 3 sa paalala na hindi sapat ang simpatya lamang. Kailangang may ebidensiya, perspektiba, at pamantayan.',
      'Photorealistic Philippine classroom stakeholder perspective dialogue with Grade 10 students around blank role cards and a community map, respectful discussion, no readable text.',
      'stakeholder-perspective-dialogue',
      'application',
      'stakeholder-perspective',
    ),
    slide(
      'Target ng Sesyon 3',
      ['Kilalanin ang apektadong grupo.', 'Suriin ang pananaw.', 'Gamitin ang criteria checklist.', 'Bumuo ng civic insight.'],
      `Opisyal na layunin: ${AP_CONTEMPORARY_ISSUES_OBJECTIVES[2]} Iugnay ang perspektiba sa karanasan ng tao, pamayanan, bansa, o daigdig.`,
    ),
    slide(
      'Hindi Sapat ang Personal Preference',
      ['Ano ang ebidensiya?', 'Kanino ito mahalaga?', 'Sino ang may kapangyarihan?', 'Sino ang mas apektado?'],
      'I-modelo ang pagkakaiba ng personal preference at criteria-based judgment. Bigyang-diin ang respeto sa magkakaibang pananaw.',
    ),
    slide(
      'Pangunahing Gawain: Perspective Analysis',
      ['Basahin ang dalawang pananaw.', 'Tukuyin ang interes at benepisyo.', 'Hanapin ang hamon at bias.', 'Suriin ang limitasyon ng impormasyon.'],
      'Ito ang pangunahing gawain ng Sesyon 3. Output: stakeholder list, perspective analysis, criteria-based judgment, at synthesis statement.',
    ),
    slide(
      'Pamantayan sa Paghatol',
      ['Makatarungan ba?', 'Praktikal ba?', 'Pangmatagalan ba?', 'Makatao ba?', 'May sapat bang source detail?'],
      'Gamitin ang pamantayan upang mailayo ang usapan sa stereotype o unsupported claim. Itanong kung aling ebidensiya ang pinakamabigat at bakit.',
    ),
    evidenceSlide(
      'Criteria-Based Dialogue',
      ['Pakinggan muna.', 'Itanong ang batayan.', 'Ihiwalay ang bias.', 'Ipaliwanag ang pasiya.'],
      'Gabayang bumuo ang learners ng pahayag na nag-uugnay ng ebidensiya, perspektiba, at pagpapahalaga. Panatilihing ligtas at magalang ang talakayan.',
      'Photorealistic classroom roundtable stakeholder dialogue with Filipino Grade 10 students using blank criteria cards and evidence photos, calm respectful tone, no readable text.',
      'stakeholder-perspective-dialogue',
      'application',
      'stakeholder-perspective',
    ),
    slide(
      'Indibidwal na Repleksiyon',
      ['Isang civic insight.', 'Isang source detail.', 'Isang perspective na ginamit.', 'Isang tanong na bukas pa.'],
      'Iwasan ang pangkalahatang payo. Kailangang may tiyak na source detail o perspective na pinagbatayan ang reflection.',
    ),
    slide(
      'Huling Suri',
      ['May ebidensiya ba?', 'Malinaw ba ang perspektiba?', 'Maingat ba ang paghatol?', 'May respeto ba sa apektado?'],
      'Gamitin ang exit check upang makita kung ang klase ay nakapagpapahayag ng pananaw nang may respeto at batayan.',
    ),
  ],
  4: [
    evidenceSlide(
      'Ano ang Dapat Patunayan ng Output?',
      ['Malinaw na claim.', 'Dalawang ebidensiya.', 'Paliwanag ng ugnayan.', 'Panukalang aksiyon.'],
      'Buksan ang Sesyon 4 sa readiness check. Kung kulang ang claim, ebidensiya, paliwanag, o significance, iyon ang target ng conference.',
      'Photorealistic classroom civic action planning workspace with Filipino Grade 10 students preparing blank planning cards, evidence photos, rubric sheets, and an action proposal, no readable text.',
      'civic-action-planning',
      'assignment',
      'civic-action',
    ),
    slide(
      'Target ng Sesyon 4',
      ['Pumili ng pinakamalinaw na ebidensiya.', 'Ayusin ang lohika ng paliwanag.', 'Gumawa ng panukalang aksiyon.', 'Magrebisa gamit ang feedback.'],
      `Opisyal na layunin: ${AP_CONTEMPORARY_ISSUES_OBJECTIVES[3]} Ituon ang slide deck sa paggawa, pagsusuri, peer review, at rebisyon ng output.`,
    ),
    slide(
      'Rubrik ng Output',
      ['Katumpakan.', 'Ebidensiya.', 'Paliwanag.', 'Kabuluhan.', 'Respeto sa perspektiba.'],
      'Ipakita ang pamantayan mula sa lesson plan. Magbigay ng mahinang halimbawa at ipasuri kung ano ang kulang.',
    ),
    slide(
      'Piliin at Ayusin ang Ebidensiya',
      ['Piliin ang dalawang source detail.', 'Unahin ang pinakadirekta.', 'Idagdag ang suportang konteksto.', 'Iugnay sa claim.'],
      'Gabayan ang learners na ayusin ang ebidensiya mula pinaka-direkta hanggang suportang konteksto upang maging lohikal ang daloy.',
    ),
    slide(
      'Pangunahing Gawain: Pagsusuri at Aksiyon',
      ['Isulat ang claim.', 'Ilagay ang dalawang ebidensiya.', 'Ipaliwanag ang kahalagahan.', 'Magmungkahi ng makatwirang aksiyon.'],
      'Ito ang pangunahing gawain ng Sesyon 4. Output: pagsusuri ng kontemporanyong isyu at panukalang aksiyon na source-supported at malinaw.',
    ),
    evidenceSlide(
      'Kumperensiya sa Peer Review',
      ['Hanapin ang claim.', 'Suriin ang ebidensiya.', 'Tanungin ang paliwanag.', 'Magmungkahi ng isang rebisyon.'],
      'Ang feedback ay kailangang nakatali sa rubrik. Iwasan ang pangkalahatang "maganda" o "kulang"; pangalanan ang bahagi na kailangang linawin.',
      'Photorealistic Philippine classroom peer review scene with students checking blank rubric cards, evidence notes, and action proposal drafts, no readable text.',
      'civic-action-planning',
      'assignment',
      'civic-action',
    ),
    slide(
      'Rebisyon na May Layunin',
      ['Palakasin ang source detail.', 'Linawin ang ugnayan.', 'Ayusin ang magalang na wika.', 'Dagdagan ang significance.'],
      'Iparebisa ang isang pangungusap upang lumakas ang ebidensiya, paliwanag, at paggalang sa perspektiba.',
    ),
    slide(
      'Pagsasara ng Linggo',
      ['Pinakamahalagang natutuhan.', 'Isang matagumpay na synthesis.', 'Isang tanong para sa susunod.', 'Isang source na puwedeng gamitin.'],
      'Itago ang output bilang review artifact para sa susunod na linggo. Gamitin ito upang tukuyin kung kailangan pa ng source reading, relationship mapping, perspective-taking, o writing support.',
    ),
  ],
};

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const reusableSignals = [
  'araling panlipunan',
  'baitang 10',
  'grade 10',
  'kontemporanyong isyu',
  'kahalagahan ng kaalaman',
  'natatalakay ang kahalagahan',
  'sesyon ng pagkatuto 1',
  'sesyon ng pagkatuto 4',
  'source notes',
  'relationship map',
  'panukalang aksiyon',
];

export const isReusableAralingPanlipunanContemporaryIssuesLesson = (content: string): boolean => {
  const normalized = normalize(content);
  if (!normalized) return false;

  const hasSubject = normalized.includes('araling panlipunan');
  const hasGrade = normalized.includes('grade 10') || normalized.includes('baitang 10');
  const score = reusableSignals.reduce((count, signal) => (
    normalized.includes(signal) ? count + 1 : count
  ), 0);

  return hasSubject && hasGrade && score >= 5;
};

const cloneSlide = (source: Slide): Slide => ({
  ...source,
  content: [...source.content],
  imageSemanticMetadata: source.imageSemanticMetadata ? { ...source.imageSemanticMetadata } : undefined,
});

const cloneSlides = (slides: Slide[]): Slide[] => slides.map(cloneSlide);

const cloneBlueprint = (): LessonBlueprint => ({
  ...apContemporaryIssuesBlueprint,
  smartObjectives: [...apContemporaryIssuesBlueprint.smartObjectives],
  studentFacingObjectives: [...apContemporaryIssuesBlueprint.studentFacingObjectives],
  days: apContemporaryIssuesBlueprint.days.map((day) => ({ ...day })),
});

export const getAralingPanlipunanContemporaryIssuesK12LessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides(initialSlides),
    },
  };
};

export const getAralingPanlipunanContemporaryIssuesK12PlanUnitSlidesSeed = (dayNumber: number): Slide[] | null => {
  const slides = sessionSlides[dayNumber] || [];
  return slides.length > 0 ? cloneSlides(slides) : null;
};

export const getAralingPanlipunanContemporaryIssuesK12CompleteLessonPlanSeed = (): CachedLessonPlanSeed => {
  const blueprint = cloneBlueprint();
  return {
    blueprint,
    initialPresentation: {
      title: blueprint.mainTitle,
      slides: cloneSlides([
        ...initialSlides,
        ...sessionSlides[1],
        ...sessionSlides[2],
        ...sessionSlides[3],
        ...sessionSlides[4],
      ]),
    },
  };
};
