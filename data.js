/* ============================================================
   وسيلة — بيانات الأقسام (مصدر الحقيقة)
   ------------------------------------------------------------
   تعديلك هنا = تعديل لكل الأجهزة بعد رفع الملف على GitHub.

   قاعدة القسم الواحد:
   { id, label, icon, img?, nurse?, options: [ ... ] }

   قاعدة الخيار:
   { label, icon, img?, nurse?, options?: [ ... ] }   ← لو له options يبقى فرع أعمق

   الصور:
   img: "images/water.jpg"          ← مسار ملف في الريبو (الأخف والأفضل)
   img: "data:image/webp;base64,…"  ← صورة مرفوعة من الجهاز (بتتحفظ جوّه الملف)
   لو فيه img بتظهر الصورة بدل الأيقونة.

   ملاحظة: "nurse: true" معناها "اسأل التمريض الأول" — بتظهر علامة 🩺
   ============================================================ */
window.APP_DATA = {
  meta: {
    version: 2,
    updated: '2026-11-04',
    perScreen: 4,
    /* رابط سيرفر المزامنة (Cloudflare Worker).
       لو حطيته هنا: أي تليفون بيفتح الموقع هياخد نفس البيانات بكود العيلة بس.
       مثال: sync: 'https://wasila-sync.username.workers.dev', */
    sync: ''
  },
  sections: [
    {
      id: 'waga',
      label: 'وجع',
      icon: 'pain',
      options: [
        { label: 'معدة', icon: 'stomach' },
        { label: 'كبد', icon: 'liver' },
        { label: 'طحال', icon: 'spleen' },
        { label: 'راس', icon: 'head' },
        { label: 'ركبة', icon: 'knee' },
        { label: 'دراع', icon: 'arm' },
        { label: 'هرش', icon: 'itch' }
      ]
    },
    {
      id: 'har-sok',
      label: 'حران / سقعان',
      icon: 'temp',
      options: [
        {
          label: 'حران',
          icon: 'sun',
          options: [
            { label: 'افتح الشباك', icon: 'window' },
            { label: 'شغل التكييف', icon: 'ac' },
            { label: 'شغل المروحة', icon: 'fan' }
          ]
        },
        {
          label: 'سقعان',
          icon: 'snow',
          options: [
            { label: 'شراب', icon: 'socks' },
            { label: 'بطانية', icon: 'blanket' },
            { label: 'اقفل التكييف', icon: 'ac' }
          ]
        },
        { label: 'عايز هوا', icon: 'fan' }
      ]
    },
    {
      id: 'akl',
      label: 'أكل وشرب',
      icon: 'cup',
      nurse: true,
      options: [
        { label: 'مية', icon: 'water', nurse: true },
        { label: 'شوربة', icon: 'soup', nurse: true },
        { label: 'عصير', icon: 'juice', nurse: true },
        { label: 'بيض', icon: 'egg', nurse: true },
        { label: 'فراخ', icon: 'chicken', nurse: true },
        { label: 'سمك', icon: 'fish', nurse: true },
        { label: 'بلاش أكل', icon: 'no' }
      ]
    },
    {
      id: 'nafas',
      label: 'تنفس',
      icon: 'lung',
      nurse: true,
      options: [
        { label: 'نفسي ضايق', icon: 'lung', nurse: true },
        { label: 'مش قادر أتنفس', icon: 'alert', nurse: true },
        { label: 'بلغم', icon: 'phlegm', nurse: true },
        { label: 'كحة', icon: 'cough', nurse: true }
      ]
    },
    {
      id: 'hammam',
      label: 'حمام',
      icon: 'toilet',
      options: [
        { label: 'عايز حمام', icon: 'toilet', nurse: true },
        { label: 'ريحة وحشة', icon: 'alert' }
      ]
    },
    {
      id: 'medayek',
      label: 'مضايقني حاجة',
      icon: 'alert',
      options: [
        {
          label: 'حد ضايقني',
          icon: 'person',
          options: [
            { label: 'دكتور', icon: 'doctor' },
            { label: 'ممرض', icon: 'nurse' },
            { label: 'حد من الاهل', icon: 'person' },
            { label: 'حد غريب', icon: 'person' }
          ]
        },
        { label: 'المكان / السرير', icon: 'bed' },
        { label: 'حرارة أو رعشة', icon: 'temp', nurse: true },
        { label: 'تعرق', icon: 'sweat' },
        { label: 'عايز أطلع من هنا', icon: 'exit' },
        { label: 'مش عارف', icon: 'help' }
      ]
    }
  ]
};
