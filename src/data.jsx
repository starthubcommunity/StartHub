// data.jsx — Translations + Content Model for Start-Hub
// Content model: people (yazarlar) → posts (Gündem/Günlük/Görüş) → projects (Lab)
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from './lib/supabase';

// ============================================
// i18n TRANSLATIONS
// ============================================
const translations = {
  tr: {
    nav: { home: 'Ana Sayfa', about: 'Hakkımızda', labs: 'Lab', blog: 'Yazılar', join: 'Katıl' },
    hero: {
      badge: 'Üniversiteli Girişim Ekosistemi',
      title1: 'Fikirlerden girişimlere.',
      title2: 'Öğrencilerden kuruculara.',
      desc: 'Start-Hub; girişim, teknoloji ve yapay zeka dünyasını Türkçe takip eden, kendi projelerini herkesin gözü önünde inşa eden bir venture builder topluluğudur.',
      cta1: "Start-Hub'a Katıl",
      cta2: "Lab'ı Keşfet",
      stat1: 'Aktif Üye', stat2: 'Proje', stat3: 'Yazı', stat4: 'Destekçi'
    },
    sections: {
      latestContent: 'Son Yazılar',
      latestContentDesc: 'Blog yazıları, gündem haberleri ve yaklaşan etkinlikler — hepsi tek akışta.',
      labProjects: 'Lab Projeleri',
      labProjectsDesc: 'Start-Hub ekosisteminde geliştirilen girişimler. Keşfet veya ekibe katıl.',
      featured: 'Öne Çıkanlar',
      featuredDesc: 'Yüksek potansiyelli, ödüllü girişimlerimiz.',
      sponsors: 'Destekçilerimiz',
      sponsorsDesc: "Start-Hub'ı mümkün kılan kurumlar ve partnerler.",
      viewAll: 'Tümünü Gör',
      learnMore: 'İncele',
      openRoles: 'açık pozisyon',
      members: 'üye',
      teamSize: 'kişi',
      readMore: 'Devamını Oku',
      minRead: 'dk okuma',
      updates: 'güncelleme',
    },
    tags: {
      all: 'Tümü',
      blog: 'Blog', blogDesc: 'Ekibimizin, mentörlerimizin ve topluluğumuzun kaleminden nitelikli yazılar.',
      gundem: 'Gündem', gundemDesc: 'Startup ve girişim dünyasından günlük önemli haberler.',
      etkinlik: 'Etkinlik', etkinlikDesc: 'Start-Hub topluluğu ve partnerlerimizin etkinlikleri.',
    },
    post: {
      source: 'Kaynak', auto: 'Otomatik çeviri', relatedProject: 'İlgili Proje', references: 'Kaynakça',
      share: 'Paylaş', backToList: 'Tüm Yazılar', writtenBy: 'Yazan', publishedOn: 'Yayın',
      morePosts: 'Bunları da oku',
    },
    cta: {
      title: 'Fikrini Start-Hub’da büyüt.',
      desc: 'Topluluğa katıl, ekibini bul, projeni herkesin gözü önünde inşa et.',
      btn: 'Aramıza Katıl'
    },
    footer: {
      desc: 'Üniversite öğrencilerini startup kurucularına dönüştüren venture builder topluluğu.',
      platform: 'Platform', company: 'Topluluk', connect: 'İletişim',
      rights: '© 2026 Start-Hub. Tüm hakları saklıdır.'
    },
    about: {
      label: 'Hakkımızda',
      title: "Start-Hub Nedir?",
      desc: "Start-Hub geleneksel bir öğrenci topluluğu değildir. Biz; öğrencilerin fikirlerini projelere, projelerini startup'lara ve startup'larını gerçek şirketlere dönüştürmesine yardımcı olan bir girişimcilik ekosistemiyiz.",
      intro: "İster yazılımcı, ister tasarımcı, ister pazarlamacı, ister girişimci ruhlu bir öğrenci ol — Start-Hub sana doğru insanları bulabileceğin, projeler geliştirebileceğin ve kendini hızla geliştirebileceğin bir ortam sunar.",
      whyLabel: 'Neden Varız?',
      whyTitle: 'Yetenek burada, fırsat eksik.',
      whyDesc1: "Türkiye'de birçok yetenekli öğrenci, doğru insanlara ve fırsatlara ulaşamadığı için potansiyelini tam olarak ortaya koyamadan mezun oluyor.",
      whyDesc2: "Biz; fikir sahiplerinin ekip bulabildiği, ekiplerin proje geliştirebildiği ve projelerin gerçek girişimlere dönüşebildiği bir ortam kurmak için Start-Hub'ı hayata geçirdik.",
      whyDesc3: "Çünkü inanıyoruz ki geleceğin büyük şirketleri, bugünün üniversite sıralarında oturan insanların arasından çıkacak.",
      pillarsLabel: 'Nasıl Çalışıyoruz',
      pillarsTitle: 'Fikirden şirkete giden dört aşama',
      pillarsDesc: 'İnsanları bir araya getiriyor, fikirleri ürüne çeviriyor ve onları gerçek girişimcilik ekosistemiyle buluşturuyoruz.',
      pillars: [
        { key: 'community', icon: 'users', color: 'var(--blue)', bg: 'var(--blue-light)', title: 'Community', tagline: 'Her şey insanlarla başlar.', desc: "Farklı üniversitelerden ve disiplinlerden üretmek isteyen insanları bir araya getiriyoruz. Burada yalnızca bağlantı kurmaz; ekip arkadaşlarını, kurucu ortaklarını ve gelecekteki girişimlerini inşa edeceğin insanları bulursun." },
        { key: 'labs', icon: 'code', color: 'var(--purple)', bg: 'var(--purple-light)', title: 'Labs', tagline: 'Fikirler uygulamada değer kazanır.', desc: "Labs içinde ekipler kurulur, projeler geliştirilir ve fikirler gerçek ürünlere dönüşür. Her proje bir fikirle başlar; ilerledikçe ekip büyür ve gerçek bir startup'a dönüşme potansiyeli kazanır." },
        { key: 'growth', icon: 'trendingUp', color: 'var(--green)', bg: 'var(--green-light)', title: 'Gelişim', tagline: 'Öğrenmenin en etkili yolu üretmektir.', desc: "Üyeler proje geliştirirken ürün, iş geliştirme, pazarlama ve liderlik alanlarında gerçek deneyim kazanır. Ortaya koydukları işler güçlü bir portfolyoya, zengin bir CV'ye ve geniş bir profesyonel ağa dönüşür." },
        { key: 'ecosystem', icon: 'handshake', color: 'var(--orange)', bg: 'var(--orange-light)', title: 'Ekosistem', tagline: 'İyi fikirler fırsatlarla büyür.', desc: "Üniversiteler, TTO'lar, TEKMER'ler ve sektör profesyonelleriyle iş birlikleri geliştiriyoruz. Böylece üyeler mentorluğa, kaynaklara ve yeni fırsatlara çok daha kolay erişir." },
      ],
      missionTitle: 'Misyonumuz',
      missionDesc: "Tutkulu ve üretken insanları bir araya getirerek; fikirlerin projelere, projelerin startup'lara ve startup'ların gerçek etki yaratan şirketlere dönüşmesini sağlamak.",
      visionTitle: 'Vizyonumuz',
      visionDesc: "Bugün insanları bir araya getiren bir topluluk; yarın projeleri startup'lara, startup'ları şirketlere dönüştüren bir Venture Builder olmak. Çünkü büyük girişimler, doğru insanların buluştuğu güçlü topluluklardan doğar.",
      flowParts: ['İnsanlardan Takımlara', "Takımlardan Startup'lara", "Startup'lardan Unicornlara"],
      teamTitle: 'Yönetim Ekibi',
      teamDesc: "Start-Hub'ı yöneten ve büyüten ekip.",
      mentorsTitle: 'Mentörlerimiz',
      mentorsDesc: 'Yolculukta bize rehberlik eden deneyimli isimler.',
      joinHubTitle: 'Sen de aramıza katıl',
      joinHubDesc: "İster bir bölümde görev al, ister bir projenin ekibine katıl — Start-Hub'da senin için bir yer var.",
      joinHubBtn: "Start-Hub'a Katıl",
      joinProjectBtn: 'Bir Projeye Katıl',
    },
    labs: {
      label: 'Lab',
      title: 'Lab Projeleri',
      desc: 'Start-Hub ekosisteminde geliştirilen tüm girişimler. Filtreleyerek keşfet veya ekibe başvur.',
      allStages: 'Tüm Aşamalar',
      applyTeam: 'Projeye Katıl',
      weeklyUpdate: 'güncelleme',
      problem: 'Problem', solution: 'Çözüm', overview: 'Genel Bakış', whatIs: 'Proje Nedir?',
      team: 'Ekip', teamLead: 'Ekip Lideri', mentor: 'Mentör', developers: 'Geliştiriciler',
      openPositions: 'Açık Pozisyonlar', noOpenPositions: 'Şu an açık pozisyon yok',
      links: 'Bağlantılar', website: 'Web Sitesi', demo: 'Demo', metrics: 'Öne Çıkan Metrikler',
      relatedPosts: 'Bu Projeden Yazılar', backToLab: "Tüm Projeler", joinThis: 'Bu Projeye Katıl',
      opportunities: 'Fırsatlar', opportunitiesDesc: 'Tüm projelerdeki açık pozisyonları keşfet ve başvur.',
      opportunitiesCount: 'açık pozisyon',
    },
    blog: {
      label: 'Yazılar', title: 'Yazılar', desc: 'Blog yazıları, gündem haberleri ve etkinlikler — tek akışta.',
    },
    events: {
      label: 'Etkinlikler', title: 'Etkinlikler',
      desc: 'Start-Hub topluluğu ve partnerlerimizin düzenlediği etkinlikler.',
      upcoming: 'Yaklaşan Etkinlikler', past: 'Geçmiş Etkinlikler',
      register: 'Kayıt Ol', organizer: 'Düzenleyen',
    },
    join: {
      label: 'Başvuru',
      title: "Start-Hub'a Katıl",
      desc: 'Topluluğumuza katıl, fikirlerini paylaş, ekip bul ve startup yolculuğuna başla.',
      name: 'Ad Soyad', email: 'E-posta', university: 'Üniversite', department: 'Bölüm',
      role: 'İlgi Alanı',
      roles: { dev: 'Yazılım Geliştirme', design: 'UI/UX Tasarım', marketing: 'Pazarlama & Growth', business: 'İş Geliştirme', content: 'İçerik & Yazı', other: 'Diğer' },
      intent: 'Ne için katılmak istiyorsun?',
      intents: { hub: 'Bir bölümde görev almak', project: 'Bir projenin ekibine katılmak', both: 'İkisi de', mentor: 'Mentör Olmak İstiyorum', sponsor: 'Destekçi / Sponsor Olmak İstiyorum' },
      bio: 'Kısa Bio', bioPlaceholder: 'Kendini kısaca tanıt, ilgi alanların ve deneyimlerin...',
      linkedin: 'LinkedIn Profili', portfolio: 'Portfolyo / GitHub',
      skills: 'Yetenekler', skillsPlaceholder: 'React, Flutter, Figma, Growth Hacking...',
      company: 'Şirket / Kurum Adı', expertise: 'Uzmanlık Alanı',
      mentorNote: 'Nasıl Katkı Sağlamak İstiyorsun?',
      mentorNotePlaceholder: 'Deneyimlerinizi, uzmanlık alanlarınızı ve katkı sağlamak istediğiniz konuları kısaca açıklayın... (max 300 karakter)',
      submit: 'Başvuruyu Gönder',
      successTitle: 'Başvurun Alındı!', successDesc: 'En kısa sürede seninle iletişime geçeceğiz.',
    },
    journey: {
      title: 'Nasıl Çalışır?', desc: 'Bir topluluktan başlayıp girişimler üreten bir venture builder’a uzanan yolculuğumuz.',
      phaseNow: 'Bugün buradayız', phaseNext: 'Sıradaki', phaseGoal: 'Hedefimiz',
      community: 'Topluluk', communityDesc: 'Öğrencileri, yetenekleri ve fikirleri bir araya getiren bir topluluk olarak başladık.',
      labs: 'Lab', labsDesc: 'Lab takımlarımız fikirleri gerçek projelere dönüştürüyor.',
      venture: 'Venture Builder', ventureDesc: 'Proje sayısı ve ekip büyüdükçe gelir geliyor; bir venture builder şirketine evriliyoruz.',
      exit: 'Exit & Spin-out', exitDesc: 'Olgunlaşan projeler bünyemizden ayrılıp bağımsız şirketlere dönüşüyor.',
      unicorn: 'Unicorn', unicornDesc: 'Hedefimiz: büyük girişimler ve unicorn’lar çıkarmak.',
    }
  },
  en: {
    nav: { home: 'Home', about: 'About', labs: 'Lab', blog: 'Posts', join: 'Join' },
    hero: {
      badge: 'University Venture Builder',
      title1: 'From ideas to startups.',
      title2: 'From students to founders.',
      desc: 'Start-Hub is a venture builder community that follows startups, tech and AI in Turkish — and builds its own projects in public.',
      cta1: 'Join Start-Hub',
      cta2: 'Explore Lab',
      stat1: 'Active Members', stat2: 'Projects', stat3: 'Posts', stat4: 'Supporters'
    },
    sections: {
      latestContent: 'Latest Posts',
      latestContentDesc: 'Blog posts, news and upcoming events — all in one feed.',
      labProjects: 'Lab Projects',
      labProjectsDesc: 'Ventures being built in the Start-Hub ecosystem. Explore or join a team.',
      featured: 'Featured',
      featuredDesc: 'Our high-potential, award-winning ventures.',
      sponsors: 'Our Supporters',
      sponsorsDesc: 'The organizations and partners that make Start-Hub possible.',
      viewAll: 'View All',
      learnMore: 'Explore',
      openRoles: 'open roles',
      members: 'members',
      teamSize: 'people',
      readMore: 'Read More',
      minRead: 'min read',
      updates: 'updates',
    },
    tags: {
      all: 'All',
      blog: 'Blog', blogDesc: 'Quality articles from our team, mentors and community.',
      gundem: 'News', gundemDesc: 'Daily startup and tech news from around the world.',
      etkinlik: 'Events', etkinlikDesc: 'Events from the Start-Hub community and our partners.',
    },
    post: {
      source: 'Source', auto: 'Auto-translated', relatedProject: 'Related Project', references: 'References',
      share: 'Share', backToList: 'All Posts', writtenBy: 'Written by', publishedOn: 'Published',
      morePosts: 'Keep reading',
    },
    cta: {
      title: 'Grow your idea at Start-Hub.',
      desc: 'Join the community, find your team, build your project in public.',
      btn: 'Join Us'
    },
    footer: {
      desc: 'A venture builder community transforming university students into startup founders.',
      platform: 'Platform', company: 'Community', connect: 'Connect',
      rights: '© 2026 Start-Hub. All rights reserved.'
    },
    about: {
      label: 'About', title: 'What is Start-Hub?',
      desc: "Start-Hub is not a traditional student club. We are an entrepreneurship ecosystem that helps students turn ideas into projects, projects into startups, and startups into real companies.",
      intro: "Whether you're a developer, a designer, a marketer or simply a student with an entrepreneurial spirit — Start-Hub gives you a place to find the right people, build projects and grow fast.",
      whyLabel: 'Why We Exist',
      whyTitle: 'The talent is here. The opportunity isn\u2019t.',
      whyDesc1: 'In Turkey, many talented students graduate without ever realizing their potential — simply because they never reached the right people and opportunities.',
      whyDesc2: 'We built Start-Hub to create a place where people with ideas can find teams, teams can build projects, and projects can grow into real ventures.',
      whyDesc3: 'Because we believe the great companies of tomorrow will come from the people sitting in today\u2019s university classrooms.',
      pillarsLabel: 'How We Work',
      pillarsTitle: 'Four stages from idea to company',
      pillarsDesc: 'We bring people together, turn ideas into products, and connect them with a real entrepreneurship ecosystem.',
      pillars: [
        { key: 'community', icon: 'users', color: 'var(--blue)', bg: 'var(--blue-light)', title: 'Community', tagline: 'Everything starts with people.', desc: 'We bring together people from different universities and disciplines who want to build. Here you don\u2019t just make connections — you find teammates, co-founders and the people you\u2019ll build your future ventures with.' },
        { key: 'labs', icon: 'code', color: 'var(--purple)', bg: 'var(--purple-light)', title: 'Labs', tagline: 'Ideas gain value through execution.', desc: 'Inside Labs, teams form, projects get built, and ideas become real products. Every project starts as an idea; as it progresses the team grows and earns the potential to become a real startup.' },
        { key: 'growth', icon: 'trendingUp', color: 'var(--green)', bg: 'var(--green-light)', title: 'Growth', tagline: 'The best way to learn is to build.', desc: 'While building projects, members gain real experience in product, business development, marketing and leadership. Their work becomes a strong portfolio, a richer CV and a wider professional network.' },
        { key: 'ecosystem', icon: 'handshake', color: 'var(--orange)', bg: 'var(--orange-light)', title: 'Ecosystem', tagline: 'Good ideas grow when they meet opportunity.', desc: 'We build partnerships with universities, tech-transfer offices, incubators and industry professionals — so members reach mentorship, resources and new opportunities far more easily.' },
      ],
      missionTitle: 'Our Mission',
      missionDesc: 'To bring passionate, productive people together and turn ideas into projects, projects into startups, and startups into companies that create real impact.',
      visionTitle: 'Our Vision',
      visionDesc: 'A community that brings people together today; a Venture Builder that turns projects into startups and startups into companies tomorrow. Because great ventures are born from strong communities of the right people.',
      flowParts: ['From People to Teams', 'From Teams to Startups', 'From Startups to Unicorns'],
      teamTitle: 'Leadership Team', teamDesc: 'The team leading and growing Start-Hub.',
      mentorsTitle: 'Our Mentors', mentorsDesc: 'Experienced people guiding us along the way.',
      joinHubTitle: 'Join us', joinHubDesc: 'Take a role in a department or join a project team — there\u2019s a place for you at Start-Hub.',
      joinHubBtn: 'Join Start-Hub', joinProjectBtn: 'Join a Project',
    },
    labs: {
      label: 'Lab', title: 'Lab Projects',
      desc: 'All ventures being built in the Start-Hub ecosystem. Filter, explore, or apply to a team.',
      allStages: 'All Stages', applyTeam: 'Join Project', weeklyUpdate: 'updates',
      problem: 'Problem', solution: 'Solution', overview: 'Overview', whatIs: 'What is it?',
      team: 'Team', teamLead: 'Team Lead', mentor: 'Mentor', developers: 'Developers',
      openPositions: 'Open Positions', noOpenPositions: 'No open positions right now',
      links: 'Links', website: 'Website', demo: 'Demo', metrics: 'Key Metrics',
      relatedPosts: 'Posts from this Project', backToLab: 'All Projects', joinThis: 'Join this Project',
      opportunities: 'Opportunities', opportunitiesDesc: 'Explore all open positions across projects and apply.',
      opportunitiesCount: 'open positions',
    },
    blog: { label: 'Posts', title: 'Posts', desc: 'Blog posts, news and events — one feed.' },
    events: {
      label: 'Events', title: 'Events',
      desc: 'Events organized by the Start-Hub community and our partners.',
      upcoming: 'Upcoming Events', past: 'Past Events',
      register: 'Register', organizer: 'Organized by',
    },
    join: {
      label: 'Apply', title: 'Join Start-Hub',
      desc: 'Join our community, share your ideas, find a team, and start your startup journey.',
      name: 'Full Name', email: 'Email', university: 'University', department: 'Department',
      role: 'Interest Area',
      roles: { dev: 'Software Development', design: 'UI/UX Design', marketing: 'Marketing & Growth', business: 'Business Development', content: 'Content & Writing', other: 'Other' },
      intent: 'Why do you want to join?',
      intents: { hub: 'Take a role in a department', project: 'Join a project team', both: 'Both', mentor: 'I want to become a Mentor', sponsor: 'I want to become a Supporter / Sponsor' },
      bio: 'Short Bio', bioPlaceholder: 'Tell us about yourself, your interests and experience...',
      linkedin: 'LinkedIn Profile', portfolio: 'Portfolio / GitHub',
      skills: 'Skills', skillsPlaceholder: 'React, Flutter, Figma, Growth Hacking...',
      company: 'Company / Organization', expertise: 'Area of Expertise',
      mentorNote: 'How do you want to contribute?',
      mentorNotePlaceholder: 'Briefly describe your experience, expertise and what you\'d like to contribute... (max 300 chars)',
      submit: 'Submit Application',
      successTitle: 'Application Received!', successDesc: "We'll get back to you shortly.",
    },
    journey: {
      title: 'How It Works', desc: 'Our journey from a community to a venture builder that launches startups.',
      phaseNow: 'We are here', phaseNext: 'Next', phaseGoal: 'Our goal',
      community: 'Community', communityDesc: 'We started as a community bringing together students, talent and ideas.',
      labs: 'Lab', labsDesc: 'Our lab teams turn ideas into real projects.',
      venture: 'Venture Builder', ventureDesc: 'As projects and teams grow, revenue follows — we evolve into a venture builder.',
      exit: 'Exit & Spin-out', exitDesc: 'Mature projects spin out of Start-Hub into independent companies.',
      unicorn: 'Unicorns', unicornDesc: 'Our goal: launch major startups and unicorns.',
    }
  }
};

// ============================================
// PEOPLE — yazarlar (ekip / mentör / partner)
// photo: null → renkli baş harf avatarı (gerçek foto eklenince src yaz)
// ============================================
const people = [
  // Tier 1 — Kurucu Başkanlar
  { id: 'can',   name: 'Can Yılmaz',     role_tr: 'Kurucu Başkan',          role_en: 'Founder & President',      type: 'team', tier: 1, color: '#DC2626', photo: null, linkedin: '#', bio_tr: 'Start-Hub\u2019ı kuran isim. Ürün vizyonu ve topluluk büyütme üzerine çalışıyor.', bio_en: 'Founder of Start-Hub, focused on product vision and community growth.' },
  { id: 'elif',  name: 'Elif Kaya',      role_tr: 'Kurucu Başkan',          role_en: 'Co-Founder & President',   type: 'team', tier: 1, color: '#2563EB', photo: null, linkedin: '#', bio_tr: 'Kurucu ortak. Strateji ve ekosistem ilişkilerini yönetiyor.', bio_en: 'Co-founder, leading strategy and ecosystem relations.' },
  // Tier 2 — Lider kadro
  { id: 'zeynep',name: 'Zeynep Arslan',  role_tr: 'İş Geliştirme Lideri',   role_en: 'Head of Business Dev.',    type: 'team', tier: 2, color: '#16A34A', photo: null, linkedin: '#', bio_tr: 'Partnerlikler ve destekçi ilişkileri üzerine çalışıyor.', bio_en: 'Works on partnerships and sponsor relations.' },
  { id: 'ahmet', name: 'Ahmet Demir',    role_tr: 'Growth Lideri',          role_en: 'Head of Growth',           type: 'team', tier: 2, color: '#7C3AED', photo: null, linkedin: '#', bio_tr: 'Büyüme, pazarlama ve topluluk kültüründen sorumlu.', bio_en: 'Owns growth, marketing and community culture.' },
  { id: 'mert',  name: 'Mert Özkan',     role_tr: 'CTO & Lab Lideri',       role_en: 'CTO & Head of Lab',        type: 'team', tier: 2, color: '#EA580C', photo: null, linkedin: '#', bio_tr: 'Lab programını ve mühendislik kültürünü yönetiyor.', bio_en: 'Runs the Lab program and engineering culture.' },
  // Tier 3 — Takım liderleri
  { id: 'sude',  name: 'Sude Çelik',     role_tr: 'İçerik Lideri',          role_en: 'Content Lead',             type: 'team', tier: 3, color: '#0891B2', photo: null, linkedin: '#', bio_tr: 'Yazıların editörlüğünü ve Gündem akışını yönetiyor.', bio_en: 'Edits posts and curates the World feed.' },
  { id: 'deniz', name: 'Deniz Aydın',    role_tr: 'Topluluk Lideri',        role_en: 'Community Lead',           type: 'team', tier: 3, color: '#D97706', photo: null, linkedin: '#', bio_tr: 'Üyeler, etkinlikler ve topluluk deneyiminden sorumlu.', bio_en: 'Owns members, events and community experience.' },
  { id: 'kerem', name: 'Kerem Şahin',    role_tr: 'Tasarım Lideri',         role_en: 'Design Lead',              type: 'team', tier: 3, color: '#DB2777', photo: null, linkedin: '#', bio_tr: 'Ürün ve marka tasarımından sorumlu.', bio_en: 'Owns product and brand design.' },
];

// ============================================
// PROJECTS (Lab) — extended model
// ============================================
const startups = [
  {
    id: 1, slug: 'fintrack', name: 'FinTrack', color: '#2563EB', stage: 'mvp',
    tagline_tr: 'Öğrenciler için kişisel finans', tagline_en: 'Personal finance for students',
    desc_tr: 'Kişisel finans ve bütçe yönetimi uygulaması.', desc_en: 'Personal finance and budget management app.',
    about_tr: 'FinTrack, üniversite öğrencilerinin harcamalarını saniyeler içinde kaydedip aylık bütçelerini görsel olarak takip etmelerini sağlayan bir mobil uygulamadır. Karmaşık bankacılık özellikleri yerine sadelik ve hızı önceliklendirir.',
    about_en: 'FinTrack is a mobile app that lets university students log expenses in seconds and track their monthly budget visually. It prioritizes simplicity and speed over complex banking features.',
    problem_tr: 'Üniversite öğrencileri sınırlı bütçeyi yönetmekte zorlanıyor; mevcut uygulamalar karmaşık ve İngilizce.',
    problem_en: 'Students struggle to manage limited budgets; existing apps are complex and English-only.',
    solution_tr: 'Banka entegrasyonu olmadan, manuel ve hızlı bütçe takibi sunan sade bir mobil deneyim.',
    solution_en: 'A simple mobile experience offering fast manual budget tracking without bank integrations.',
    tags: ['FinTech', 'Mobil', 'AI'], team: 4, openRoles: 2, score: 78, updates: 12,
    website: '#', demo: '#', github: '#',
    leadId: 'mert', memberIds: ['can'], mentorId: 'burak',
    openRolesList_tr: ['Flutter Geliştirici', 'UI/UX Tasarımcı'], openRolesList_en: ['Flutter Developer', 'UI/UX Designer'],
    metrics: [{ label_tr: 'Beta kullanıcı', label_en: 'Beta users', value: '320' }, { label_tr: 'Haftalık aktif', label_en: 'Weekly active', value: '%41' }, { label_tr: 'Lab\u2019da', label_en: 'In Lab', value: '4 ay' }],
    trending: true, featured: false, isNew: false,
  },
  {
    id: 2, slug: 'ecoroute', name: 'EcoRoute', color: '#16A34A', stage: 'building',
    tagline_tr: 'Sürdürülebilir şehir içi ulaşım', tagline_en: 'Sustainable urban mobility',
    desc_tr: 'Sürdürülebilir şehir içi ulaşım planlayıcı.', desc_en: 'Sustainable urban transportation planner.',
    about_tr: 'EcoRoute, şehir içi yolculukları planlarken yalnızca süreyi değil karbon ayak izini de hesaba katan bir ulaşım asistanıdır. Toplu taşıma, bisiklet ve yürüyüşü tek bir akıllı rotada birleştirir.',
    about_en: 'EcoRoute is a mobility assistant that factors carbon footprint — not just time — into urban trip planning, combining transit, cycling and walking into a single smart route.',
    problem_tr: 'Şehir içi ulaşımda en hızlı rota her zaman en az karbon salan rota değil.',
    problem_en: 'In cities, the fastest route is rarely the lowest-carbon route.',
    solution_tr: 'Toplu taşıma, bisiklet ve yürüyüşü birleştirerek karbon ayak izini gösteren rota motoru.',
    solution_en: 'A routing engine combining transit, cycling and walking while showing carbon footprint.',
    tags: ['GreenTech', 'Maps', 'Mobil'], team: 5, openRoles: 1, score: 88, updates: 18,
    website: '#', demo: '#', github: '#',
    leadId: 'elif', memberIds: ['zeynep'], mentorId: 'mehmet',
    openRolesList_tr: ['Backend Geliştirici'], openRolesList_en: ['Backend Developer'],
    metrics: [{ label_tr: 'Şehir', label_en: 'Cities', value: '3' }, { label_tr: 'Rota/gün', label_en: 'Routes/day', value: '1.2K' }, { label_tr: 'Ekip', label_en: 'Team', value: '5' }],
    trending: true, featured: false, isNew: false,
  },
  {
    id: 3, slug: 'studymate', name: 'StudyMate', color: '#7C3AED', stage: 'growth',
    tagline_tr: 'AI destekli öğrenme', tagline_en: 'AI-powered learning',
    desc_tr: 'AI destekli öğrenme ve sınav hazırlık platformu.', desc_en: 'AI-powered learning and exam preparation platform.',
    about_tr: 'StudyMate, öğrencilerin ders notlarını yükleyip yapay zeka ile otomatik quizlere dönüştürdüğü, zayıf olduğu konulara göre kişisel tekrar planı oluşturan bir öğrenme platformudur.',
    about_en: 'StudyMate is a learning platform where students upload their notes, turn them into AI-generated quizzes, and get a personalized review plan based on their weak topics.',
    problem_tr: 'Öğrenciler dağınık kaynaklarla çalışıyor; kişiselleştirilmiş tekrar planı yapmak zor.',
    problem_en: 'Students study with scattered resources; building a personalized review plan is hard.',
    solution_tr: 'Ders notlarından otomatik quiz üreten, zayıf konulara göre tekrar planı çıkaran bir asistan.',
    solution_en: 'An assistant that auto-generates quizzes from notes and plans reviews by weak topics.',
    tags: ['EdTech', 'AI/LLM', 'SaaS'], team: 7, openRoles: 3, score: 95, updates: 24,
    website: '#', demo: '#', github: '#',
    leadId: 'mert', memberIds: ['sude', 'ahmet'], mentorId: 'ayse',
    openRolesList_tr: ['ML Mühendisi', 'Growth Pazarlama', 'Frontend Geliştirici'], openRolesList_en: ['ML Engineer', 'Growth Marketer', 'Frontend Developer'],
    metrics: [{ label_tr: 'Kullanıcı', label_en: 'Users', value: '8.4K' }, { label_tr: 'Aylık büyüme', label_en: 'MoM growth', value: '%22' }, { label_tr: 'Quiz/ay', label_en: 'Quizzes/mo', value: '120K' }],
    trending: true, featured: true, isNew: false,
  },
  {
    id: 4, slug: 'healthpulse', name: 'HealthPulse', color: '#DC2626', stage: 'idea',
    tagline_tr: 'Dijital sağlık asistanı', tagline_en: 'Digital health assistant',
    desc_tr: 'Dijital sağlık takip ve teşhis asistanı.', desc_en: 'Digital health tracking and diagnosis assistant.',
    about_tr: 'HealthPulse, giyilebilir cihazlardan gelen sağlık verilerini tek bir panelde toplayıp anlamlı eğilimlere dönüştüren bir dijital sağlık asistanıdır. Kronik takip gerektiren kullanıcıları hedefler.',
    about_en: 'HealthPulse is a digital health assistant that consolidates wearable data into a single dashboard and turns it into meaningful trends, targeting users who need chronic monitoring.',
    problem_tr: 'Kronik takip gerektiren hastalar verilerini tek yerde toplayamıyor.',
    problem_en: 'Patients needing chronic monitoring can\u2019t consolidate their data in one place.',
    solution_tr: 'Giyilebilir cihaz verilerini birleştirip eğilimleri sade bir panelde gösteren bir uygulama.',
    solution_en: 'An app that unifies wearable data and surfaces trends in a simple dashboard.',
    tags: ['HealthTech', 'AI', 'Wearables'], team: 3, openRoles: 4, score: 42, updates: 3,
    website: '#', demo: '#', github: '#',
    leadId: 'can', memberIds: [], mentorId: 'burak',
    openRolesList_tr: ['Mobil Geliştirici', 'Veri Bilimci', 'Sağlık Danışmanı', 'Tasarımcı'], openRolesList_en: ['Mobile Developer', 'Data Scientist', 'Health Advisor', 'Designer'],
    metrics: [{ label_tr: 'Aşama', label_en: 'Stage', value: 'Fikir' }, { label_tr: 'Ekip', label_en: 'Team', value: '3' }, { label_tr: 'Açık rol', label_en: 'Open roles', value: '4' }],
    trending: false, featured: false, isNew: true,
  },
  {
    id: 5, slug: 'foodchain', name: 'FoodChain', color: '#EA580C', stage: 'launch',
    tagline_tr: 'Restoran tedarik zinciri', tagline_en: 'Restaurant supply chain',
    desc_tr: 'Restoran tedarik zinciri optimizasyonu.', desc_en: 'Restaurant supply chain optimization.',
    about_tr: 'FoodChain, küçük ve orta ölçekli restoranların tedarik süreçlerini veriyle yöneten bir B2B platformudur. Talep tahminiyle sipariş önerir, tedarikçi fiyatlarını kıyaslar ve israfı azaltır.',
    about_en: 'FoodChain is a B2B platform that manages supply for small and mid-size restaurants with data — suggesting orders via demand forecasting, comparing supplier prices and cutting waste.',
    problem_tr: 'Küçük restoranlar tedarik israfı ve fiyat dalgalanmalarıyla kâr kaybediyor.',
    problem_en: 'Small restaurants lose margin to supply waste and price volatility.',
    solution_tr: 'Talep tahmini ile sipariş öneren, tedarikçi fiyatlarını kıyaslayan bir B2B platform.',
    solution_en: 'A B2B platform suggesting orders via demand forecasting and comparing supplier prices.',
    tags: ['FoodTech', 'B2B', 'Logistics'], team: 6, openRoles: 0, score: 84, updates: 15,
    website: '#', demo: '#', github: '#',
    leadId: 'zeynep', memberIds: ['elif'], mentorId: 'selin',
    openRolesList_tr: [], openRolesList_en: [],
    metrics: [{ label_tr: 'Restoran', label_en: 'Restaurants', value: '46' }, { label_tr: 'GMV', label_en: 'GMV', value: '₺2.1M' }, { label_tr: 'İsraf ↓', label_en: 'Waste ↓', value: '%18' }],
    trending: true, featured: false, isNew: false,
  },
  {
    id: 6, slug: 'codebuddy', name: 'CodeBuddy', color: '#0891B2', stage: 'mvp',
    tagline_tr: 'Junior geliştiriciler için eşli kodlama', tagline_en: 'Pair programming for juniors',
    desc_tr: 'Junior geliştiriciler için pair programming platformu.', desc_en: 'Pair programming platform for junior developers.',
    about_tr: 'CodeBuddy, yeni başlayan geliştiricileri deneyimli mentörlerle eşleştiren ve oturum içi kod inceleme araçları sunan bir eşli kodlama platformudur.',
    about_en: 'CodeBuddy is a pair-programming platform that matches junior developers with experienced mentors and provides in-session code review tools.',
    problem_tr: 'Yeni başlayan geliştiriciler gerçek kod incelemesi ve mentorluk bulmakta zorlanıyor.',
    problem_en: 'Beginner developers struggle to find real code review and mentorship.',
    solution_tr: 'Junior\u2019ları deneyimli geliştiricilerle eşleştiren, oturum içi araçlar sunan bir platform.',
    solution_en: 'A platform matching juniors with experienced developers, with in-session tooling.',
    tags: ['DevTools', 'SaaS', 'Eğitim'], team: 4, openRoles: 2, score: 56, updates: 6,
    website: '#', demo: '#', github: '#',
    leadId: 'ahmet', memberIds: ['mert'], mentorId: 'burak',
    openRolesList_tr: ['Topluluk Yöneticisi', 'Full-stack Geliştirici'], openRolesList_en: ['Community Manager', 'Full-stack Developer'],
    metrics: [{ label_tr: 'Eşleşme', label_en: 'Matches', value: '210' }, { label_tr: 'Mentor', label_en: 'Mentors', value: '34' }, { label_tr: 'NPS', label_en: 'NPS', value: '62' }],
    trending: false, featured: false, isNew: true,
  },
];

// ============================================
// POSTS — Supabase'den çekilir (bkz. dosya sonu: POSTS_FALLBACK)
// ============================================

function mapPost(row) {
  return {
    id:          row.id,
    slug:        row.slug        || '',
    tag:         row.tag         || 'blog',
    authorId:    row.author_id   || null,
    projectId:   row.project_id  || null,
    date:        row.date        || '',
    readTime:    row.read_time   || 5,
    bg:          row.bg          || 'var(--blue-light)',
    cover:       row.image_url   || null,
    source:      row.source ? { name: row.source, url: row.source_url || '#' } : null,
    title_tr:    row.title_tr    || '',
    title_en:    row.title_en    || '',
    excerpt_tr:  row.excerpt_tr  || '',
    excerpt_en:  row.excerpt_en  || '',
    body_tr:     row.body_tr     || [],
    body_en:     row.body_en     || [],
    homePinned:  row.home_pinned  || false,
    recommended: row.recommended  || false,
    guestAuthor: row.guest_author || null,
  };
}

// Modül seviyesi önbellek — PostsProvider günceller; getPost/postsForProject buradan okur
let postsCache = [];

// POSTS_FALLBACK — eski hardcoded dizi (Supabase boşsa referans)
/* const POSTS_FALLBACK = [
  {
    id: 101, tag: 'gundem', authorId: 'sude', projectId: null, date: '2026-06-06', readTime: 4, bg: 'var(--blue-light)',
    source: { name: 'TechCrunch', url: '#' },
    title_tr: 'OpenAI yeni nesil ajan modelini duyurdu — ekosisteme etkisi',
    title_en: 'OpenAI announces next-gen agent model — impact on the ecosystem',
    excerpt_tr: 'Dünyadan seçilmiş gelişmeleri kendi yazım üslubumuzla Türkçeleştiriyoruz.',
    excerpt_en: 'We curate world news and translate it into Turkish in our own voice.',
    body_tr: ['Yeni model, çok adımlı görevleri tek komutla tamamlayabiliyor.', 'Erken aşama girişimler için bu, ürün geliştirme döngüsünü ciddi biçimde kısaltabilir.', 'Start-Hub Lab ekiplerinin de bu araçları nasıl kullanacağını önümüzdeki haftalarda paylaşacağız.'],
    body_en: ['The new model can complete multi-step tasks from a single prompt.', 'For early-stage startups this can dramatically shorten the build cycle.', 'We\u2019ll share how Start-Hub Lab teams adopt these tools in the coming weeks.'],
  },
  {
    id: 102, tag: 'blog', authorId: 'mert', projectId: 1, date: '2026-06-04', readTime: 6, bg: 'var(--red-light)',
    source: null,
    title_tr: 'FinTrack: ödeme akışında yaptığımız 3 büyük hata',
    title_en: 'FinTrack: 3 big mistakes we made in the payment flow',
    excerpt_tr: 'Built-in-public — projemizin gidişatı, hatalarımız ve öğrendiklerimiz.',
    excerpt_en: 'Built-in-public — our progress, mistakes and learnings.',
    body_tr: ['İlk sürümde kullanıcıyı çok fazla adıma zorladık ve bırakma oranı yükseldi.', 'İkinci hatamız: bankacılık entegrasyonunu erken denedik, oysa manuel giriş yeterliydi.', 'Üçüncüsü, fiyatlandırmayı çok geç test ettik. Artık her özelliği önce küçük bir grupla deniyoruz.'],
    body_en: ['In v1 we forced too many steps and drop-off rose.', 'Second mistake: we tried banking integration too early when manual entry was enough.', 'Third, we tested pricing too late. Now we trial every feature with a small cohort first.'],
  },
  {
    id: 103, tag: 'blog', authorId: 'ayse', projectId: 3, date: '2026-06-02', readTime: 5, bg: 'var(--purple-light)',
    source: null,
    title_tr: 'Erken aşamada mentörlük neden işe yarar?',
    title_en: 'Why mentorship works at the early stage',
    excerpt_tr: 'Mentörümüzün kaleminden topluluğa dair bir değerlendirme.',
    excerpt_en: 'A reflection from our mentor for the community.',
    body_tr: ['Mentörlük tavsiye vermek değil, doğru soruları sormaktır.', 'StudyMate ekibiyle çalışırken en çok "neden" sorusunun işe yaradığını gördüm.', 'Yatırımcıya güven veren şey ekibin öğrenme hızıdır; bunu da şeffaflıkla gösterirsiniz.'],
    body_en: ['Mentorship isn\u2019t giving advice, it\u2019s asking the right questions.', 'Working with StudyMate, the "why" question proved most useful.', 'What builds investor trust is a team\u2019s learning speed — shown through transparency.'],
  },
  {
    id: 104, tag: 'gundem', authorId: 'sude', projectId: null, date: '2026-05-30', readTime: 5, bg: 'var(--green-light)',
    source: { name: 'Wired', url: '#' },
    title_tr: 'Yapay zeka startup ekosistemini nasıl dönüştürüyor?',
    title_en: 'How AI is transforming the startup ecosystem',
    excerpt_tr: 'AI araçlarının girişimcilik süreçlerine etkisi ve gelecek öngörüleri.',
    excerpt_en: 'The impact of AI tools on entrepreneurship and future predictions.',
    body_tr: ['Tek kişilik ekiplerin kurabileceği ürünlerin sınırı hızla genişliyor.', 'Bu, dağıtım ve topluluk gibi "insan" katmanlarını daha da değerli kılıyor.'],
    body_en: ['The ceiling for what solo teams can build is rising fast.', 'This makes human layers like distribution and community even more valuable.'],
  },
  {
    id: 105, tag: 'blog', authorId: 'elif', projectId: 2, date: '2026-05-27', readTime: 4, bg: 'var(--orange-light)',
    source: null,
    title_tr: 'EcoRoute: ilk pilot şehirde öğrendiklerimiz',
    title_en: 'EcoRoute: what we learned in the first pilot city',
    excerpt_tr: 'Saha verisi beklediğimizden farklı çıktı; planı buna göre güncelledik.',
    excerpt_en: 'Field data differed from expectations; we updated the plan accordingly.',
    body_tr: ['Kullanıcılar karbon verisini önemsedi ama önce hız ve güvenilirlik istiyor.', 'Bu yüzden yol motorunu yeniden önceliklendirdik.'],
    body_en: ['Users cared about carbon data but want speed and reliability first.', 'So we re-prioritized the routing engine.'],
  },
  {
    id: 106, tag: 'blog', authorId: 'burak', projectId: null, date: '2026-05-24', readTime: 7, bg: 'var(--blue-light)',
    source: null,
    title_tr: 'Bir MVP\u2019yi ne zaman yeniden yazmalısın?',
    title_en: 'When should you rewrite an MVP?',
    excerpt_tr: 'Teknik borç ve hız arasındaki dengeyi mentör gözünden ele alıyoruz.',
    excerpt_en: 'Balancing technical debt and speed from a mentor\u2019s perspective.',
    body_tr: ['Çoğu ekip çok erken yeniden yazıyor.', 'Kural basit: yeniden yazma kararı müşteri değil, ölçek sorunuysa doğrudur.'],
    body_en: ['Most teams rewrite too early.', 'Simple rule: a rewrite is right when it\u2019s a scale problem, not a customer one.'],
  },
]; */

const postsForProject  = (projectId) => postsCache.filter(p => p.projectId === projectId);
const getPost          = (id)   => postsCache.find(p => p.id === id || p.id === Number(id));
const getPostBySlug    = (slug) => postsCache.find(p => p.slug === slug);
const getPostSlug      = (id)   => postsCache.find(p => p.id === id || p.id === Number(id))?.slug || null;

const PostsContext = createContext({ posts: [], postsLoading: true, postsError: null });

function PostsProvider({ children }) {
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState(null);

  const load = useCallback(async (opts = {}) => {
    const { silent = false } = opts;
    if (!silent) setPostsLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'published')
        .order('date', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(mapPost);
      postsCache = mapped;
      setPosts(mapped);
      setPostsError(null);
    } catch (err) {
      console.error('[Posts] Supabase yükleme hatası:', err.message);
      setPostsError(err.message);
    } finally {
      if (!silent) setPostsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Kullanıcı başka tab'dan (ör. admin) döndüğünde sessizce yenile
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load({ silent: true }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return React.createElement(PostsContext.Provider, { value: { posts, postsLoading, postsError } }, children);
}

const usePosts = () => useContext(PostsContext);

// ============================================
// CONTENT MAP FUNCTIONS — Supabase satırı → JS nesnesi
// ============================================
function mapPerson(row) {
  return {
    id:         row.id,
    name:       row.name         || '',
    role_tr:    row.role_tr      || '',
    role_en:    row.role_en      || '',
    type:       row.type         || 'team',
    tier:       row.tier         ?? null,
    color:      row.color        || '#2563EB',
    photo:      row.photo        || null,
    linkedin:   row.linkedin     || '#',
    bio_tr:     row.bio_tr       || '',
    bio_en:     row.bio_en       || '',
    sort_order: row.sort_order   ?? 99,
    projectId:  row.project_id   ?? null,
  };
}

function mapStartup(row) {
  return {
    id:               row.id,
    slug:             row.slug               || '',
    name:             row.name               || '',
    color:            row.color              || '#2563EB',
    stage:            row.stage              || 'idea',
    tagline_tr:       row.tagline_tr         || '',
    tagline_en:       row.tagline_en         || '',
    desc_tr:          row.desc_tr            || '',
    desc_en:          row.desc_en            || '',
    about_tr:         row.about_tr           || '',
    about_en:         row.about_en           || '',
    problem_tr:       row.problem_tr         || '',
    problem_en:       row.problem_en         || '',
    solution_tr:      row.solution_tr        || '',
    solution_en:      row.solution_en        || '',
    tags:             row.tags               || [],
    team:             row.team               || 0,
    openRoles:        row.open_roles         || 0,
    score:            row.score              || 0,
    updates:          row.updates            || 0,
    website:          row.website            || null,
    demo:             row.demo               || null,
    github:           row.github             || null,
    leadId:           row.lead_id            || null,
    memberIds:        row.member_ids         || [],
    mentorId:         row.mentor_id          || null,
    openRolesList_tr: row.open_roles_list_tr || [],
    openRolesList_en: row.open_roles_list_en || [],
    metrics:          row.metrics            || [],
    trending:         row.trending           || false,
    featured:         row.featured           || false,
    isNew:            row.is_new             || false,
  };
}

function mapSponsor(row) {
  return {
    id:         row.id,
    name:       row.name       || '',
    color:      row.color      || '#2563EB',
    logo:       row.logo       || null,
    url:        row.url        || '#',
    desc_tr:    row.desc_tr    || '',
    desc_en:    row.desc_en    || '',
    sort_order: row.sort_order ?? 99,
  };
}

function mapEvent(row) {
  return {
    id:          row.id,
    title_tr:    row.title_tr    || '',
    title_en:    row.title_en    || '',
    desc_tr:     row.desc_tr     || '',
    desc_en:     row.desc_en     || '',
    date:        row.date        || '',
    time:        row.time        || '00:00',
    location_tr: row.location_tr || '',
    location_en: row.location_en || '',
    organizer:   row.organizer   || '',
    type:        row.type        || 'meetup',
    link:        row.link        || '#',
    cover:       row.cover       || null,
    color:       row.color       || '#2563EB',
  };
}

// ============================================
// CONTENT PROVIDER — people/startups/sponsors/events → Supabase
// ============================================
const ContentContext = createContext({
  people: [], startups: [], sponsors: [], events: [], contentLoading: true,
});

function ContentProvider({ children }) {
  const [contentLoading, setContentLoading] = useState(true);
  const [content, setContent] = useState({ people, startups, sponsors, events });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          { data: pRows,  error: e1 },
          { data: sRows,  error: e2 },
          { data: spRows, error: e3 },
          { data: eRows,  error: e4 },
        ] = await Promise.all([
          supabase.from('people').select('*').order('sort_order'),
          supabase.from('startups').select('*').order('id'),
          supabase.from('sponsors').select('*').order('sort_order'),
          supabase.from('events').select('*').order('date'),
        ]);
        if (e1 || e2 || e3 || e4) throw (e1 || e2 || e3 || e4);
        if (cancelled) return;

        const mp  = (pRows  || []).map(mapPerson);
        const ms  = (sRows  || []).map(mapStartup);
        const msp = (spRows || []).map(mapSponsor);
        const me  = (eRows  || []).map(mapEvent);

        // Modül dizilerini yerinde güncelle (teamMembers/mentors türetmesi için)
        people.length   = 0; mp.forEach(x  => people.push(x));
        startups.length = 0; ms.forEach(x  => startups.push(x));
        sponsors.length = 0; msp.forEach(x => sponsors.push(x));
        events.length   = 0; me.forEach(x  => events.push(x));
        teamMembers.length = 0; people.filter(p => p.type === 'team').forEach(x   => teamMembers.push(x));
        mentors.length     = 0; people.filter(p => p.type === 'mentor').forEach(x => mentors.push(x));

        setContent({ people: mp, startups: ms, sponsors: msp, events: me });
      } catch (err) {
        console.error('[Content] Supabase yükleme hatası:', err.message);
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return React.createElement(ContentContext.Provider, { value: { ...content, contentLoading } }, children);
}

const usePeople   = () => { const { people:   p,  contentLoading } = useContext(ContentContext); return { people:   p,  contentLoading }; };
const useStartups = () => { const { startups: s,  contentLoading } = useContext(ContentContext); return { startups: s,  contentLoading }; };
const useSponsors = () => { const { sponsors: sp, contentLoading } = useContext(ContentContext); return { sponsors: sp, contentLoading }; };
const useEvents   = () => { const { events:   e,  contentLoading } = useContext(ContentContext); return { events:   e,  contentLoading }; };

// ============================================
// SPONSORS — kayan şerit
// ============================================
const sponsors = [
  { name: 'Teknopark İstanbul', color: '#2563EB', logo: null, url: '#', desc_tr: 'Türkiye\u2019nin en büyük teknoloji geliştirme bölgesi; ofis, kuluçka ve ekosistem erişimi sağlıyor.', desc_en: 'Turkey\u2019s largest technology development zone, offering office space, incubation and ecosystem access.' },
  { name: 'TÜBİTAK TEKMER', color: '#16A34A', logo: null, url: '#', desc_tr: 'Erken aşama girişimlere Ar-Ge hibesi ve kuluçka desteği veren kamu programı.', desc_en: 'Public program providing R&D grants and incubation support to early-stage startups.' },
  { name: 'Microsoft for Startups', color: '#0078D4', logo: null, url: '#', desc_tr: 'Azure bulut kredisi, teknik mentorluk ve kurumsal ağ erişimi sunuyor.', desc_en: 'Provides Azure cloud credits, technical mentorship and enterprise network access.' },
  { name: 'Google for Startups', color: '#EA4335', logo: null, url: '#', desc_tr: 'Girişimlere ürün, eğitim ve global topluluk desteği sağlayan program.', desc_en: 'Program offering product, training and global community support to startups.' },
  { name: 'AWS Activate', color: '#FF9900', logo: null, url: '#', desc_tr: 'Startuplara bulut altyapı kredisi ve teknik destek paketleri veriyor.', desc_en: 'Offers cloud infrastructure credits and technical support packages to startups.' },
  { name: 'Haliç Üniversitesi', color: '#1E293B', logo: null, url: '#', desc_tr: 'Akademik iş birliği, mekan desteği ve öğrenci topluluğuna erişim partnerimiz.', desc_en: 'Our partner for academic collaboration, venue support and student community access.' },
  { name: 'Üniversite TTO', color: '#7C3AED', logo: null, url: '#', desc_tr: 'Teknoloji transferi, fikri mülkiyet ve patent süreçlerinde rehberlik sağlıyor.', desc_en: 'Provides guidance on technology transfer, intellectual property and patent processes.' },
  { name: 'Startup Turkey', color: '#DC2626', logo: null, url: '#', desc_tr: 'Girişim ekosisteminin önde gelen etkinlik ve ağ kurma partneri.', desc_en: 'A leading events and networking partner of the startup ecosystem.' },
];

// ============================================
// EVENTS — etkinlikler
// ============================================
const events = [
  {
    id: 'ev1',
    title_tr: 'Startup Weekend Istanbul', title_en: 'Startup Weekend Istanbul',
    desc_tr: '54 saatte fikirden MVP\'ye. Start-Hub ekibi olarak katılıyoruz.',
    desc_en: 'From idea to MVP in 54 hours. Joining as the Start-Hub team.',
    date: '2026-06-28', time: '10:00',
    location_tr: 'Teknopark İstanbul', location_en: 'Teknopark Istanbul',
    organizer: 'Start-Hub & Teknopark',
    type: 'hackathon', link: '#', cover: null, color: '#DC2626',
  },
  {
    id: 'ev2',
    title_tr: 'AI & Girişimcilik Paneli', title_en: 'AI & Entrepreneurship Panel',
    desc_tr: 'Yapay zekanın startup ekosistemindeki rolünü tartışıyoruz.',
    desc_en: 'Discussing the role of AI in the startup ecosystem.',
    date: '2026-07-05', time: '14:00',
    location_tr: 'Online (Zoom)', location_en: 'Online (Zoom)',
    organizer: 'Start-Hub',
    type: 'webinar', link: '#', cover: null, color: '#2563EB',
  },
  {
    id: 'ev3',
    title_tr: 'Aylık Topluluk Buluşması #12', title_en: 'Monthly Community Meetup #12',
    desc_tr: 'Her ayın ilk cumartesi bir araya gelip projelerimizi paylaşıyoruz.',
    desc_en: 'We meet every first Saturday to share our projects.',
    date: '2026-07-12', time: '15:00',
    location_tr: 'Haliç Üniversitesi, Beyoğlu Kampüsü', location_en: 'Haliç University, Beyoğlu Campus',
    organizer: 'Start-Hub',
    type: 'meetup', link: '#', cover: null, color: '#16A34A',
  },
  {
    id: 'ev4',
    title_tr: 'Product Design Workshop', title_en: 'Product Design Workshop',
    desc_tr: 'Figma ile ürün tasarımı atölyesi. Sınırlı kontenjan!',
    desc_en: 'Product design workshop with Figma. Limited seats!',
    date: '2026-07-20', time: '11:00',
    location_tr: 'Start-Hub Ofis, Maslak', location_en: 'Start-Hub Office, Maslak',
    organizer: 'Start-Hub & Haliç Üniversitesi',
    type: 'workshop', link: '#', cover: null, color: '#7C3AED',
  },
];

// Backwards-compat aliases
const teamMembers = people.filter(p => p.type === 'team');
const mentors = people.filter(p => p.type === 'mentor');
const partners = sponsors;

// ============================================
// SITE STATS — hero rakamları (auto = veriden hesapla / manual = elle gir)
// ============================================
const defaultSiteStats = {
  members:  { mode: 'manual', value: 240, suffix: '+' },
  projects: { mode: 'auto',   value: 18,  suffix: ''  },
  posts:    { mode: 'auto',   value: 35,  suffix: '+' },
  sponsors: { mode: 'manual', value: 12,  suffix: ''  },
  openRoles:{ mode: 'auto',   value: 0,   suffix: ''  },
};
let siteStats = defaultSiteStats;

// Snapshot of seed content BEFORE any localStorage override — used by the
// admin panel for "Sıfırla" and for one-time content reconciliation.
const SH_DEFAULTS = {
  people:   JSON.parse(JSON.stringify(people)),
  startups: JSON.parse(JSON.stringify(startups)),
  sponsors: JSON.parse(JSON.stringify(sponsors)),
  events:   JSON.parse(JSON.stringify(events)),
  // posts: Supabase'de yönetiliyor, burada seed yok
};

// ============================================
// ADMIN OVERRIDE — panelden kaydedilen içeriği siteye uygula
// data.jsx hem sitede hem panelde yüklendiği için tek kaynak burası.
// Diziler yerinde (in-place) güncellenir; tüm window referansları otomatik yansır.
// ============================================
(function applyAdminOverrides() {
  let admin = null;
  try { admin = JSON.parse(localStorage.getItem('sh_admin_data') || 'null'); } catch (e) {}
  if (!admin) return;
  // people/startups/sponsors/events → Supabase'den yükleniyor, localStorage atlanıyor
  if (admin.siteStats) siteStats = { ...defaultSiteStats, ...admin.siteStats };
})();

const resolveStat = (key) => {
  const s = siteStats[key];
  if (!s) return 0;
  if (s.mode === 'auto') {
    if (key === 'projects')  return startups.length;
    if (key === 'posts')     return postsCache.length;
    if (key === 'openRoles') return startups.reduce((a, b) => a + (b.openRoles || 0), 0);
    if (key === 'sponsors')  return sponsors.length;
    if (key === 'members')   return people.length;
  }
  return s.value;
};

// ============================================
// SITE SETTINGS — Supabase site_settings tablosu
// SQL: CREATE TABLE site_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
//      INSERT INTO site_settings VALUES('company_linkedin','https://www.linkedin.com/company/111725833/') ON CONFLICT DO NOTHING;
//      ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
//      CREATE POLICY "public read" ON site_settings FOR SELECT USING (true);
//      CREATE POLICY "auth write" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
// ============================================
const SETTINGS_DEFAULTS = {
  company_linkedin:    'https://www.linkedin.com/company/111725833/',
  contact_email:       'iletisim@starthub-community.com',
  announcement_active: false,
  announcement_text:   '',
  maintenance_mode:    false,
};
let settingsCache = { ...SETTINGS_DEFAULTS };
let settingsLoaded = false;

function useSiteSettings() {
  const [settings, setSettings] = useState(() => ({ ...settingsCache }));
  useEffect(() => {
    if (settingsLoaded) { setSettings({ ...settingsCache }); return; }
    supabase.from('site_settings')
      .select('company_linkedin, contact_email, announcement_text, announcement_active, maintenance_mode')
      .eq('id', 1).single()
      .then(({ data }) => {
        if (data) {
          settingsLoaded = true;
          if (data.company_linkedin)  settingsCache.company_linkedin    = data.company_linkedin;
          if (data.contact_email)     settingsCache.contact_email       = data.contact_email;
          settingsCache.announcement_active = data.announcement_active ?? false;
          settingsCache.announcement_text   = data.announcement_text   ?? '';
          settingsCache.maintenance_mode    = data.maintenance_mode    ?? false;
          setSettings({ ...settingsCache });
        }
      });
  }, []);
  return settings;
}

// ============================================
// LANGUAGE CONTEXT
// ============================================
const LangContext = createContext({ lang: 'tr', t: (k) => k, setLang: () => {} });
function useLang() { return useContext(LangContext); }

function LangProvider({ children, lang, setLang }) {
  const t = useCallback((key) => {
    const keys = key.split('.');
    let result = translations[lang];
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) return key;
    }
    return result;
  }, [lang]);

  const localized = useCallback((obj, field) => {
    return obj[`${field}_${lang}`] || obj[field] || '';
  }, [lang]);

  return React.createElement(LangContext.Provider, { value: { lang, t, setLang, localized } }, children);
}

export {
  translations, people, startups, sponsors, events,
  teamMembers, mentors, partners, siteStats, defaultSiteStats, resolveStat, SH_DEFAULTS,
  getPost, getPostBySlug, getPostSlug, postsForProject,
  mapPerson, mapStartup, mapSponsor, mapEvent,
  LangContext, useLang, LangProvider,
  PostsContext, PostsProvider, usePosts,
  ContentContext, ContentProvider, usePeople, useStartups, useSponsors, useEvents,
  useSiteSettings, settingsCache, SETTINGS_DEFAULTS,
};
