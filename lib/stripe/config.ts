// Stripe configuration and pricing

export const STRIPE_PLANS = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with robotics education",
    price: 0,
    priceId: null,
    features: [
      "3 courses access",
      "Basic simulator arenas",
      "Block-based programming",
      "Community support",
    ],
    limits: {
      courses: 3,
      projects: 5,
      arenas: 3,
      aiGenerations: 10,
    },
  },
  premium: {
    id: "premium",
    name: "Premium",
    description: "For serious learners and hobbyists",
    price: 9.99,
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    features: [
      "All courses & content",
      "All simulator arenas",
      "Python & Arduino code",
      "Unlimited AI generations",
      "Priority support",
      "Exclusive challenges",
    ],
    limits: {
      courses: -1, // unlimited
      projects: -1,
      arenas: -1,
      aiGenerations: -1,
    },
  },
  education: {
    id: "education",
    name: "Education",
    description: "For schools and educators",
    price: 49.99,
    priceId: process.env.STRIPE_EDUCATION_PRICE_ID,
    features: [
      "Everything in Premium",
      "Educator dashboard",
      "Classroom management",
      "Student progress tracking",
      "Analytics & reports",
      "LMS integration",
      "Dedicated support",
    ],
    limits: {
      courses: -1,
      projects: -1,
      arenas: -1,
      aiGenerations: -1,
      classrooms: 10,
      studentsPerClass: 35,
    },
  },
} as const

export type PlanId = keyof typeof STRIPE_PLANS
export type Plan = (typeof STRIPE_PLANS)[PlanId]

export function getPlanById(planId: string): Plan | null {
  return STRIPE_PLANS[planId as PlanId] ?? null
}

export function isPremiumFeature(feature: string): boolean {
  const premiumFeatures = [
    "python_code",
    "advanced_arenas",
    "unlimited_ai",
    "advanced_courses",
    "challenges",
  ]
  return premiumFeatures.includes(feature)
}

export function isEducatorFeature(feature: string): boolean {
  const educatorFeatures = [
    "classroom_management",
    "student_tracking",
    "analytics",
    "lms_integration",
  ]
  return educatorFeatures.includes(feature)
}


