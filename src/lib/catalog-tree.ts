/**
 * Catalog Tree Taxonomy for the General Educational Buildings Authority 2026 Price List
 */
import { normalizeItemCode, sectionOf, type Section } from "./estimate-utils";

export interface TreeNode {
  id: string;
  label: string;
  section: "ordinary" | "sanitary" | "electrical" | "all";
  codePrefix?: string;
  codePrefixes?: string[];
  partMatch?: string;
  children?: TreeNode[];
  icon?: string;
}

export const CATALOG_TREE_DATA: TreeNode[] = [
  {
    id: "ordinary",
    label: "أولاً: الأعمال الاعتيادية",
    section: "ordinary",
    children: [
      {
        id: "site_work",
        label: "الباب الأول: أعمال الموقع العام وتنسيقه",
        section: "ordinary",
        codePrefix: "01",
        partMatch: "الموقع العام",
        children: [
          { id: "01/01", label: "أعمال الهدم والإزالة ونقل المخلفات وبيع الخردة", section: "ordinary", codePrefix: "01/01" },
          { id: "01/02", label: "أعمال التسوية وتطهير ونظافة الموقع والفرش بالليزر", section: "ordinary", codePrefix: "01/02" },
          { id: "01/03", label: "فرش ودك طبقات التربة الزلطية والسن", section: "ordinary", codePrefix: "01/03" },
          { id: "01/04", label: "إنشاء وترميم أسوار الموقع العام وقواطع الأسوار", section: "ordinary", codePrefix: "01/04" },
          { id: "01/05", label: "بوابات الموقع العام والحديد والكريتال", section: "ordinary", codePrefix: "01/05" },
          { id: "01/06", label: "بلاطات خرسانية وأرضيات الفناء والممرات والإنترلوك", section: "ordinary", codePrefix: "01/06" },
          { id: "01/07", label: "خرسانات عادية وسلالم الموقع والبردورات والأرصفة", section: "ordinary", codePrefix: "01/07" },
          { id: "01/08", label: "ملاعب نجيل صناعي وتجهيزات رياضية وترتان", section: "ordinary", codePrefix: "01/08" },
          { id: "01/09", label: "تنسيق الموقع العام والنافورات والمظلات والبرجولات", section: "ordinary", codePrefix: "01/09" },
        ],
      },
      {
        id: "foundations",
        label: "الباب الثاني: أعمال الأساسات والردم",
        section: "ordinary",
        codePrefix: "02",
        partMatch: "الاساسات",
        children: [
          { id: "02/01", label: "حفر وردم وترحيل نواتج الحفر وسند الجوانب", section: "ordinary", codePrefix: "02/01" },
          { id: "02/02", label: "خرسانة عادية للأساسات وفرشات النظافة", section: "ordinary", codePrefix: "02/02" },
          { id: "02/03", label: "خرسانة مسلحة للقواعد والسملات والشدادات", section: "ordinary", codePrefix: "02/03" },
          { id: "02/04", label: "خوازيق ارتكاز واحتكاك ميكانيكية وتجارب التحميل", section: "ordinary", codePrefix: "02/04" },
          { id: "02/05", label: "مباني قصية الردم تحت منسوب الأرضية", section: "ordinary", codePrefix: "02/05" },
          { id: "02/06", label: "عزل رطوبة الأساسات والبيتومين المؤكسد والممبراين", section: "ordinary", codePrefix: "02/06" },
        ],
      },
      {
        id: "structure",
        label: "الباب الثالث: أعمال الهيكل والتشطيبات المعمارية",
        section: "ordinary",
        codePrefix: "03",
        partMatch: "الهيكل",
        children: [
          { id: "03/01", label: "دكات خرسانية عادية للأدوار الأرضية", section: "ordinary", codePrefix: "03/01" },
          { id: "03/02", label: "خرسانة مسلحة للأعمدة والحوائط والأسقف والكمرات", section: "ordinary", codePrefix: "03/02" },
          { id: "03/03", label: "فواصل التمدد والهبوط والفواصل الإنشائية", section: "ordinary", codePrefix: "03/03" },
          { id: "03/04", label: "أعمال المباني من الطوب الطفلي والأسمنتي", section: "ordinary", codePrefix: "03/04" },
          { id: "03/05", label: "أعمال العزل المائي والحراري للأسطح والحمامات", section: "ordinary", codePrefix: "03/05" },
          { id: "03/06", label: "أعمال البياض الداخلي والخارجي والمصيص والكرانيش", section: "ordinary", codePrefix: "03/06" },
          { id: "03/07", label: "أعمال الدهانات البلاستيكية والزيتية والإيبوكسي", section: "ordinary", codePrefix: "03/07" },
          { id: "03/08", label: "أعمال الأرضيات والبلاط الموزايكو والأسمنتي", section: "ordinary", codePrefix: "03/08" },
          { id: "03/09", label: "أعمال السيراميك والبورسلين للحوائط والأرضيات", section: "ordinary", codePrefix: "03/09" },
          { id: "03/10", label: "أعمال الرخام والجرانيت للأرضيات والدرج والواجهات", section: "ordinary", codePrefix: "03/10" },
          { id: "03/11", label: "أعمال النجارة المعمارية للأبواب والشبابيك والكوالين", section: "ordinary", codePrefix: "03/11" },
          { id: "03/12", label: "أعمال الكريتال والحديد المشغول والمقصات والأبواب الحديدية", section: "ordinary", codePrefix: "03/12" },
          { id: "03/13", label: "أعمال الألومنيوم والواجهات والزجاج", section: "ordinary", codePrefix: "03/13" },
          { id: "03/14", label: "أعمال تنسيق الحدائق والزراعة والردم النظيف", section: "ordinary", codePrefix: "03/14" },
          { id: "03/15", label: "أعمال الكاونترات واللافتات واللوحات الإرشادية والترميم", section: "ordinary", codePrefix: "03/15" },
          { id: "03/16", label: "أعمال الهدم والإزالة والترميم وتكسير المباني الإنشائية", section: "ordinary", codePrefix: "03/16" },
        ],
      },
    ],
  },
  {
    id: "sanitary",
    label: "ثانياً: الأعمال الصحية والشبكات",
    section: "sanitary",
    codePrefix: "05",
    children: [
      { id: "05/01", label: "أجهزة الحمامات والمراحيض والأحواض والخلاطات والصناديق", section: "sanitary", codePrefix: "05/01" },
      { id: "05/02", label: "شبكات ومواسير التغذية بالمياه والمحابس والوصلات", section: "sanitary", codePrefix: "05/02" },
      { id: "05/03", label: "شبكات الصرف الصحي ومواسير الزهر والـ PVC وغرف التفتيش", section: "sanitary", codePrefix: "05/03" },
      { id: "05/04", label: "شبكات ومهمات إطفاء الحريق وصناديق وحنفيات الحريق", section: "sanitary", codePrefix: "05/04" },
    ],
  },
  {
    id: "electrical",
    label: "ثالثاً: الأعمال الكهربائية والتيار الخفيف",
    section: "electrical",
    codePrefix: "06",
    partMatch: "الكهربائية",
    children: [
      {
        id: "elec_lighting",
        label: "وحدات الإنارة وكشافات الليد والمفاتيح والبرايز والمراوح",
        section: "electrical",
        codePrefix: "06/01",
      },
      {
        id: "elec_wiring",
        label: "مخارج الإنارة والقوى والتمديدات والمواسير وعلب الاتصال",
        section: "electrical",
        codePrefix: "06/02",
      },
      {
        id: "elec_earthing",
        label: "شبكات التأريض الصناعي وقضبان التأريض وغرف التفتيش",
        section: "electrical",
        codePrefix: "06/03",
      },
      {
        id: "elec_junction_boxes",
        label: "علب النهاية الصاج والكوفريات المعدنية",
        section: "electrical",
        codePrefix: "06/04",
      },
      {
        id: "elec_cables",
        label: "الكابلات والأسلاك النحاسية والألومنيوم الهوائية والأرضية",
        section: "electrical",
        codePrefix: "06/06",
      },
      {
        id: "elec_panels_group",
        label: "لوحات التوزيع العمومية والفرعية والقواطع الأوتوماتيكية والمصهرات",
        section: "electrical",
        codePrefixes: ["06/17", "06/24", "06/25", "06/26", "06/27"],
        children: [
          {
            id: "elec_panels_25",
            label: "لوحات توزيع صاج دهان إلكتروستاتيك (بند 06/25)",
            section: "electrical",
            codePrefix: "06/25",
          },
          {
            id: "elec_panels_26",
            label: "لوحات توزيع صاج مسحوب على الساخن (بند 06/26)",
            section: "electrical",
            codePrefix: "06/26",
          },
          {
            id: "elec_panels_24",
            label: "لوحات توزيع مصهرة وصناديق قواطع (بند 06/24)",
            section: "electrical",
            codePrefix: "06/24",
          },
          {
            id: "elec_panels_17",
            label: "لوحات توزيع كهربية أحادية 1PH داخل الحائط (بند 06/17)",
            section: "electrical",
            codePrefix: "06/17",
          },
          {
            id: "elec_breakers_27",
            label: "قواطع ثلاثية وأحادية أوتوماتيكية B.C.M (بند 06/27)",
            section: "electrical",
            codePrefix: "06/27",
          },
        ],
      },
      {
        id: "elec_busbars",
        label: "البارات النحاسية سابقة التجهيز وقضبان التغذية",
        section: "electrical",
        codePrefix: "06/10",
      },
      {
        id: "elec_hvac_fans",
        label: "مراوح الطرد المركزي ومجاري الهواء وموزعات التكييف",
        section: "electrical",
        codePrefix: "06/13",
      },
      {
        id: "elec_elevators",
        label: "المصاعد الكهربائية ومصاعد المرضى ومهماتها",
        section: "electrical",
        codePrefix: "06/15",
      },
      {
        id: "elec_low_current_group",
        label: "أنظمة التيار الخفيف وشبكات المعلومات والإنذار والمراقبة",
        section: "electrical",
        codePrefixes: ["06/07", "06/08", "06/09", "06/14", "06/28"],
        children: [
          {
            id: "elec_fire_alarm",
            label: "الإنذار التلقائي ضد الحريق وكواشف الدخان والحرارة (06/08)",
            section: "electrical",
            codePrefix: "06/08",
          },
          {
            id: "elec_data_networks",
            label: "شبكات المعلومات وكابلات CAT6 والباتش بانل (06/14)",
            section: "electrical",
            codePrefix: "06/14",
          },
          {
            id: "elec_sound_system",
            label: "الإذاعة الداخلية والصوتيات والسماعات (06/09)",
            section: "electrical",
            codePrefix: "06/09",
          },
          {
            id: "elec_cctv_generators",
            label: "المولدات الاحتياطية وكاميرات المراقبة CCTV والدش (06/28)",
            section: "electrical",
            codePrefix: "06/28",
          },
          {
            id: "elec_telephony",
            label: "شبكة التليفونات الداخلية والسنترال (06/07)",
            section: "electrical",
            codePrefix: "06/07",
          },
        ],
      },
    ],
  },
];

/**
 * Normalizes an item code to canonical format for tree matching
 */
export function getCanonicalItemCode(code: string, part?: string, section?: string): string {
  const validSection =
    section === "ordinary" || section === "sanitary" || section === "electrical"
      ? (section as Section)
      : undefined;
  return normalizeItemCode(code, part, validSection);
}

export function getItemSection(item: { code: string; part?: string; section?: string }): Section {
  const validSection =
    item.section === "ordinary" || item.section === "sanitary" || item.section === "electrical"
      ? (item.section as Section)
      : undefined;
  return sectionOf(item.code, validSection, item.part);
}

/**
 * Checks whether an item matches a specific selected node in the hierarchy
 */
export function matchItemToTreeNode(item: { code: string; part?: string; section?: string }, nodeId: string): boolean {
  if (!nodeId || nodeId === "all") return true;

  const itemSection = getItemSection(item);

  // Top level section matching
  if (nodeId === "ordinary") return itemSection === "ordinary";
  if (nodeId === "sanitary") return itemSection === "sanitary";
  if (nodeId === "electrical") return itemSection === "electrical";

  // Check against flat lookup of nodes
  function findNode(nodes: TreeNode[]): TreeNode | null {
    for (const n of nodes) {
      if (n.id === nodeId) return n;
      if (n.children) {
        const found = findNode(n.children);
        if (found) return found;
      }
    }
    return null;
  }

  const targetNode = findNode(CATALOG_TREE_DATA);
  if (!targetNode) return true;

  // Strict section barrier: prevent any cross-section mixing
  if (targetNode.section && targetNode.section !== "all" && targetNode.section !== itemSection) {
    return false;
  }

  const canonicalCode = getCanonicalItemCode(item.code, item.part, item.section);

  // Part name match
  if (targetNode.partMatch && item.part && item.part.includes(targetNode.partMatch)) {
    return true;
  }

  // Exact code prefix match (e.g. "01/04" or "02" or "06/01")
  if (targetNode.codePrefix) {
    if (canonicalCode.startsWith(targetNode.codePrefix)) return true;
  }

  // Multiple prefixes match
  if (targetNode.codePrefixes && targetNode.codePrefixes.length > 0) {
    for (const p of targetNode.codePrefixes) {
      if (canonicalCode.startsWith(p)) return true;
    }
  }

  // If node has children, check if item matches any child
  if (targetNode.children && targetNode.children.length > 0) {
    for (const child of targetNode.children) {
      if (matchItemToTreeNode(item, child.id)) return true;
    }
  }

  return false;
}

/**
 * Precomputes item counts for all nodes in the tree
 */
export function computeTreeCounts(items: { code: string; part?: string; section?: string }[]): Record<string, number> {
  const counts: Record<string, number> = { all: items.length };

  function processNode(node: TreeNode) {
    let count = 0;
    for (const item of items) {
      if (matchItemToTreeNode(item, node.id)) {
        count++;
      }
    }
    counts[node.id] = count;
    if (node.children) {
      node.children.forEach(processNode);
    }
  }

  CATALOG_TREE_DATA.forEach(processNode);
  return counts;
}

/**
 * Finds a TreeNode by its ID across the entire hierarchy
 */
export function findTreeNodeById(nodeId: string, nodes: TreeNode[] = CATALOG_TREE_DATA): TreeNode | null {
  for (const n of nodes) {
    if (n.id === nodeId) return n;
    if (n.children) {
      const found = findTreeNodeById(nodeId, n.children);
      if (found) return found;
    }
  }
  return null;
}

export interface ItemTreePath {
  sectionId: string;
  sectionLabel: string;
  chapterLabel: string;
  branchLabel: string;
  leafId: string;
  canonicalCode: string;
}

/**
 * Resolves the full hierarchical tree path (Section -> Chapter -> Branch) for any catalog or estimate item
 */
export function resolveItemTreePath(item: { code: string; part?: string; section?: string }): ItemTreePath {
  const canonicalCode = getCanonicalItemCode(item.code, item.part, item.section);
  const sec = getItemSection(item);

  const rootNode = CATALOG_TREE_DATA.find((n) => n.id === sec) || CATALOG_TREE_DATA[0];
  const sectionLabel = rootNode.label;

  // Walk down children to find exact leaf
  if (rootNode.children) {
    for (const lvl2 of rootNode.children) {
      if (lvl2.children && lvl2.children.length > 0) {
        for (const lvl3 of lvl2.children) {
          if (matchItemToTreeNode(item, lvl3.id)) {
            return {
              sectionId: rootNode.id,
              sectionLabel,
              chapterLabel: lvl2.label,
              branchLabel: lvl3.label,
              leafId: lvl3.id,
              canonicalCode,
            };
          }
        }
        if (matchItemToTreeNode(item, lvl2.id)) {
          return {
            sectionId: rootNode.id,
            sectionLabel,
            chapterLabel: lvl2.label,
            branchLabel: lvl2.label,
            leafId: lvl2.id,
            canonicalCode,
          };
        }
      } else if (matchItemToTreeNode(item, lvl2.id)) {
        return {
          sectionId: rootNode.id,
          sectionLabel,
          chapterLabel: rootNode.label,
          branchLabel: lvl2.label,
          leafId: lvl2.id,
          canonicalCode,
        };
      }
    }
  }

  return {
    sectionId: rootNode.id,
    sectionLabel,
    chapterLabel: item.part || rootNode.label,
    branchLabel: "بنود متنوعة / مضافة يدوياً",
    leafId: rootNode.id,
    canonicalCode,
  };
}
