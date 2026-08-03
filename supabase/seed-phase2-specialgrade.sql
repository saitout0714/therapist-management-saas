-- Seed script for Special Grade store (Phase 2 HP integration)

DO $$ 
DECLARE
    v_shop_id UUID;
    v_th1_id UUID := '00000000-0000-4000-a000-000000000001'::UUID;
    v_th2_id UUID := '00000000-0000-4000-a000-000000000002'::UUID;
    v_th3_id UUID := '00000000-0000-4000-a000-000000000003'::UUID;
    v_th4_id UUID := '00000000-0000-4000-a000-000000000004'::UUID;
BEGIN
    -- 1. Ensure Special Grade Shop exists
    SELECT id INTO v_shop_id FROM public.shops WHERE slug = 'specialgrade';
    IF v_shop_id IS NULL THEN
        INSERT INTO public.shops (
            name, slug, catchphrase, logo_url, theme_color,
            address, access_info, business_hours, phone,
            x_url, litlink_url, notice_banner, is_active
        ) VALUES (
            'Special Grade', 'specialgrade',
            '赤羽・川口 メンズエステ ～上質で優雅な至福の空間～',
            '/images/banners/somelogo.png',
            '{"primary":"#d1b464","accent":"#a39573","darkBg":"#464646","lightBg":"#faf7f0"}'::jsonb,
            '東京都北区赤羽 / 埼玉県川口市',
            '赤羽駅徒歩2分・川口駅徒歩3分',
            'OPEN/11:00～5:00 (受付/10:30〜2:00)',
            '070-1462-0389',
            'https://x.com',
            'https://lit.link',
            '✨ 赤羽・川口エリアで選ばれ続ける最高級メンズエステ ✨',
            true
        ) RETURNING id INTO v_shop_id;
    ELSE
        UPDATE public.shops SET
            catchphrase = '赤羽・川口 メンズエステ ～上質で優雅な至福の空間～',
            logo_url = '/images/banners/somelogo.png',
            theme_color = '{"primary":"#d1b464","accent":"#a39573","darkBg":"#464646","lightBg":"#faf7f0"}'::jsonb,
            address = '東京都北区赤羽 / 埼玉県川口市',
            access_info = '赤羽駅徒歩2分・川口駅徒歩3分',
            business_hours = 'OPEN/11:00～5:00 (受付/10:30〜2:00)',
            phone = '070-1462-0389',
            x_url = 'https://x.com',
            litlink_url = 'https://lit.link',
            notice_banner = '✨ 赤羽・川口エリアで選ばれ続ける最高級メンズエステ ✨'
        WHERE id = v_shop_id;
    END IF;

    -- 2. Therapists
    INSERT INTO public.therapists (
        id, shop_id, name, name_kana, age, height, bust_cup, three_size,
        photo_url, avatar_url, badge, grade, tags, comment, twitter_url, litlink_url, is_new, is_active, display_order
    ) VALUES 
    (
        v_th1_id, v_shop_id, 'みく', 'ミク', 21, 162, 'E', 'B86(E) W58 H87',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
        'NEW', '注目新人', ARRAY['スレンダー', '癒し系', '愛嬌抜群', '密着施術'],
        'はじめまして！みくです✨ 心も体もぽかぽかに解きほぐせるように一生懸命施術します。',
        'https://x.com', 'https://lit.link', true, true, 1
    ),
    (
        v_th2_id, v_shop_id, 'あおい', 'アオイ', 24, 166, 'F', 'B89(F) W59 H88',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
        NULL, 'トップセラピスト', ARRAY['モデル体型', '美人系', '本格密着', 'リピート率No1'],
        '日々の疲れやお悩みを忘れられるような特別なひと時をお届けします。',
        'https://x.com', NULL, false, true, 2
    ),
    (
        v_th3_id, v_shop_id, 'りな', 'リナ', 22, 158, 'D', 'B84(D) W57 H85',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80',
        'PICKUP', '人気急上昇', ARRAY['小柄可愛い', '聞き上手', 'モチモチ肌', '癒やしボイス'],
        'お客様の笑顔が私の元気の源です♪ ゆっくりリラックスしていってくださいね！',
        'https://x.com', NULL, false, true, 3
    ),
    (
        v_th4_id, v_shop_id, 'ほのか', 'ホノカ', 23, 160, 'E', 'B85(E) W58 H86',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80',
        NULL, 'レギュラー', ARRAY['お姉さん系', '包容力', '密着技術', '丁寧な施術'],
        '包み込むような温かいトリートメントをお約束します。',
        NULL, NULL, false, true, 4
    )
    ON CONFLICT (id) DO UPDATE SET
        shop_id = EXCLUDED.shop_id,
        name = EXCLUDED.name,
        name_kana = EXCLUDED.name_kana,
        age = EXCLUDED.age,
        height = EXCLUDED.height,
        bust_cup = EXCLUDED.bust_cup,
        three_size = EXCLUDED.three_size,
        photo_url = EXCLUDED.photo_url,
        avatar_url = EXCLUDED.avatar_url,
        badge = EXCLUDED.badge,
        grade = EXCLUDED.grade,
        tags = EXCLUDED.tags,
        comment = EXCLUDED.comment,
        twitter_url = EXCLUDED.twitter_url,
        litlink_url = EXCLUDED.litlink_url,
        is_new = EXCLUDED.is_new,
        is_active = EXCLUDED.is_active,
        display_order = EXCLUDED.display_order;

    -- 3. Therapist Photos
    DELETE FROM public.therapist_photos WHERE therapist_id IN (v_th1_id, v_th2_id, v_th3_id, v_th4_id);
    INSERT INTO public.therapist_photos (therapist_id, photo_url, display_order) VALUES
    (v_th1_id, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80', 1),
    (v_th1_id, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80', 2),
    (v_th1_id, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80', 3),
    (v_th2_id, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80', 1),
    (v_th2_id, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80', 2),
    (v_th3_id, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80', 1),
    (v_th4_id, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80', 1);

    -- 4. Blog Articles (Diaries)
    DELETE FROM public.blog_articles WHERE shop_id = v_shop_id;
    INSERT INTO public.blog_articles (id, shop_id, therapist_id, title, content, eye_catch_url, tags, published_at) VALUES
    (
        '00000000-0000-4000-b000-000000000001'::UUID, v_shop_id, v_th1_id,
        '本日も出勤しています♡ 新しいオイル入荷しました！',
        'こんにちは！みくです✨\n\n今日はお天気が良くて気持ちいいですね♪\nお店に新しいローズ＆ラベンダーのスペシャルオイルが入荷しました！香りもとっても良くてリラックス効果抜群です♡\n本日の空き時間もありますので、ぜひ癒されにいらしてくださいね！お待ちしております♪',
        'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&auto=format&fit=crop&q=80',
        ARRAY['出勤情報', 'オイル紹介'], NOW() - INTERVAL '2 hours'
    ),
    (
        '00000000-0000-4000-b000-000000000002'::UUID, v_shop_id, v_th2_id,
        '昨日はご指名ありがとうございました✨',
        'あおいです！昨日ご来店くださったお客様、楽しいお時間をありがとうございました！お疲れが溜まっていらっしゃったので、しっかり解きほぐさせていただきました。またお会いできるのを楽しみにしております♪',
        NULL,
        ARRAY['お礼', '日記'], NOW() - INTERVAL '1 day'
    );

    -- 5. News Items
    DELETE FROM public.news_items WHERE shop_id = v_shop_id;
    INSERT INTO public.news_items (id, shop_id, title, content, category, published_at) VALUES
    (
        '00000000-0000-4000-c000-000000000001'::UUID, v_shop_id,
        '【重要】ホームページをリニューアルオープンいたしました！',
        'いつもスペシャルグレードをご愛顧いただき誠にありがとうございます。より綺麗で見やすい公式Webサイトへリニューアルいたしました。',
        'お知らせ', NOW() - INTERVAL '3 days'
    ),
    (
        '00000000-0000-4000-c000-000000000002'::UUID, v_shop_id,
        'ホットオイルコース好評実施中',
        '温もりとともに深いリラクゼーションをもたらす人気コースです。冷えや疲労が気になる方にもおすすめです。',
        'イベント', NOW() - INTERVAL '5 days'
    );

    -- 6. Campaigns / Banners
    DELETE FROM public.campaigns WHERE shop_id = v_shop_id;
    INSERT INTO public.campaigns (shop_id, title, image_url, description, badge_text, display_order, is_active) VALUES
    (v_shop_id, 'Special Grade - ONLY ONE RELAXATION PLACE', '/images/banners/top0023.jpg', 'Thank you for choosing us from the many men''s esthe. Don''t think feel!', '公式', 1, true),
    (v_shop_id, '当店ご利用初めてのお客様 はじめまして割 ¥1,000-off', '/images/banners/新人割引1000.jpg', '初回ご来店のお客様限定！受付時申告で¥1,000引き適応。', '初回限定', 2, true),
    (v_shop_id, 'WEB予約 新しく便利になりました', '/images/banners/systembanner.jpg', 'PCでもスマホでも24時間いつでも簡単ネット予約。', '便利', 3, true),
    (v_shop_id, 'LINE公式アカウント 友だち募集中', '/images/banners/top0002.jpg', 'お得なクーポンや出勤情報をLINEで配信中！', 'LINE', 4, true),
    (v_shop_id, 'Special Grade - 極上のリラクゼーション', '/images/banners/top0001.jpg', '技術・ルックス・心遣いの三点を厳選したセラピストたち。', '厳選', 5, true);

END $$;
