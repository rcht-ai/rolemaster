// Default field template applied to new submissions. Mirrors the prototype
// section/label structure but starts with empty values.

export const DEFAULT_FIELD_TEMPLATE = {
  // Section 1 — Company basics (auto-filled from supplier record)
  company_name:    { section: 1, label: { zh: "公司名称", en: "Company name" } },
  company_hq:      { section: 1, label: { zh: "总部", en: "Headquarters" } },
  company_founded: { section: 1, label: { zh: "成立年份", en: "Founded" }, optional: true },
  company_team:    { section: 1, label: { zh: "团队规模", en: "Team size" }, optional: true },
  company_clients: { section: 1, label: { zh: "现有企业客户", en: "Enterprise clients" }, optional: true },

  user_industry:   { section: 2, label: { zh: "目标行业", en: "Target industries" } },
  user_orgsize:    { section: 2, label: { zh: "客户组织规模", en: "Org size" } },
  user_role:       { section: 2, label: { zh: "使用者角色", en: "User role" } },
  user_seniority:  { section: 2, label: { zh: "资历", en: "Seniority" } },
  user_daily:      { section: 2, label: { zh: "日常工作内容", en: "Daily activities" } },

  buyer_role:       { section: 3, label: { zh: "决策者", en: "Decision-maker" } },
  buyer_priorities: { section: 3, label: { zh: "采购方关注点", en: "Buyer priorities" } },
  buyer_budget:     { section: 3, label: { zh: "预算区间", en: "Typical budget" }, optional: true },

  pain_main:       { section: 4, label: { zh: "客户当前主要痛点", en: "Main pain" } },
  pain_workaround: { section: 4, label: { zh: "客户当前如何处理", en: "Current workaround" } },
  pain_outcome:    { section: 4, label: { zh: "量化效果(可选)", en: "Quantified outcomes (optional)" }, optional: true },

  do_capabilities: { section: 5, label: { zh: "产品能做什么动作", en: "What actions does it perform" } },
  do_knowledge:    { section: 5, label: { zh: "内置了哪些规则、SOP、行业知识", en: "Embedded knowledge / SOPs" } },
  do_interfaces:   { section: 5, label: { zh: "需要对接哪些系统", en: "What systems does it integrate with" } },

  deploy_mode:    { section: 6, label: { zh: "部署方式", en: "Deployment mode" } },
  deploy_regions: { section: 6, label: { zh: "已落地区域", en: "Production regions" } },
  deploy_lang:    { section: 6, label: { zh: "支持语言", en: "Supported languages" } },
  deploy_reg:     { section: 6, label: { zh: "监管合规(可选)", en: "Regulatory (optional)" }, optional: true },

  svc_demo:     { section: 7, label: { zh: "演示偏好", en: "Demo preferences" } },
  svc_assist:   { section: 7, label: { zh: "是否愿意配合销售", en: "Sales-assist willingness" } },
  svc_response: { section: 7, label: { zh: "响应时间", en: "Response SLA" } },
  svc_scope:    { section: 7, label: { zh: "交付范围", en: "Delivery scope" } },
  svc_lang:     { section: 7, label: { zh: "支持语言", en: "Support languages" } },

  price_model:   { section: 8, label: { zh: "定价模式", en: "Pricing model" } },
  price_cost:    { section: 8, label: { zh: "成本价(对我方)", en: "Cost (to us)" } },
  price_retail:  { section: 8, label: { zh: "建议零售价", en: "Suggested retail" } },
  price_custom:  { section: 8, label: { zh: "私有化部署起价", en: "Private deployment from" }, optional: true },
  price_service: { section: 8, label: { zh: "定制服务费(可选)", en: "Custom service fee (optional)" }, optional: true },
};
