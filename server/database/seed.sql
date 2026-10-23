-- Zion Catering Services
-- Seed Data for MySQL
-- Database: bisublar_zc

USE bisublar_zc;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE notifications;
TRUNCATE TABLE contact_inquiries;
TRUNCATE TABLE reviews_feedback;
TRUNCATE TABLE event_tasks;
TRUNCATE TABLE event_staff_assignments;
TRUNCATE TABLE payments;
TRUNCATE TABLE booking_addons;
TRUNCATE TABLE bookings;
TRUNCATE TABLE package_addon_links;
TRUNCATE TABLE addons;
TRUNCATE TABLE menu_items;
TRUNCATE TABLE package_inclusions;
TRUNCATE TABLE packages;
TRUNCATE TABLE staff_profiles;
TRUNCATE TABLE customer_saved_venues;
TRUNCATE TABLE customers;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Insert Users (Password is 'admin123' for admin, 'staff123' for staff, 'customer123' for customers)
INSERT INTO users (id, firstName, lastName, email, phone, passwordHash, role, status) VALUES
(1, 'Admin', 'Zion', 'admin@zioncatering.ph', '+63 917 000 0001', '$2b$10$jxsY/AANdkwLsQUTp8x3uOall5lPVISVrmkCCl4lY0Xkya.vX9Ity', 'admin', 'active'),
(2, 'Michael', 'Chef', 'chef@zioncatering.ph', '+63 917 000 0002', '$2b$10$p4ZiXjCRu6SGZq/Quh4Rm.3DWkXBToQ.Hv9IJTYSE9B7BOM7u2aci', 'staff', 'active'),
(3, 'Maria', 'Santos', 'coordinator@zioncatering.ph', '+63 917 000 0003', '$2b$10$p4ZiXjCRu6SGZq/Quh4Rm.3DWkXBToQ.Hv9IJTYSE9B7BOM7u2aci', 'staff', 'active'),
(4, 'Rico', 'Torres', 'service@zioncatering.ph', '+63 917 000 0004', '$2b$10$p4ZiXjCRu6SGZq/Quh4Rm.3DWkXBToQ.Hv9IJTYSE9B7BOM7u2aci', 'staff', 'active'),
(5, 'Demo', 'Customer', 'demo@zionfood.ph', '+63 917 123 4567', '$2b$10$dp730rD9wgtY4BzTXv.SQe2LtMp1UEJpHioERxEAJFj.3FGKZSdO6', 'customer', 'active'),
(6, 'John Angelo', 'Banga', 'johnangelobanga@gmail.com', '+63 917 999 8888', '$2b$10$dp730rD9wgtY4BzTXv.SQe2LtMp1UEJpHioERxEAJFj.3FGKZSdO6', 'customer', 'active');

-- 2. Insert Staff Profiles
INSERT INTO staff_profiles (id, user_id, position, department, hire_date, status, emergency_contact_name, emergency_contact_phone) VALUES
(1, 2, 'Head Chef', 'kitchen', '2024-01-15', 'available', 'Teresa Chef', '+63 918 111 2222'),
(2, 3, 'Event Coordinator', 'coordination', '2024-03-01', 'available', 'Pedro Santos', '+63 918 333 4444'),
(3, 4, 'Banquet Service Lead', 'service', '2024-05-10', 'available', 'Lina Torres', '+63 918 555 6666');

-- 3. Insert Customers
INSERT INTO customers (id, user_id, alt_phone, address, city, province) VALUES
(1, 5, '+63 917 111 2233', 'Poblacion II', 'Tagbilaran City', 'Bohol'),
(2, 6, '', 'Brgy. Cogon', 'Tagbilaran City', 'Bohol');

-- 4. Insert Customer Saved Venues
INSERT INTO customer_saved_venues (customer_id, name, address) VALUES
(1, 'Tagbilaran City Hall', 'J.A. Clarin Street, Tagbilaran City'),
(1, 'Bohol Tropics Resort', 'Graham Avenue, Tagbilaran City'),
(2, 'Dao Diamond Hotel', 'Km. 3, Dao District, Tagbilaran City');

-- 5. Insert Packages
INSERT INTO packages (id, code, name, category, icon, price_per_head, min_guests, tagline, rating, badge, image_url, is_active) VALUES
(1, 'wed', 'Eternal Vows Wedding', 'Wedding', 'sparkles-outline', 650.00, 80, 'Full-course banquet with reception styling', 4.90, 'Popular', 'https://images.unsplash.com/photo-1739440426771-8265663f8899?w=900&h=620&fit=crop&auto=format', 1),
(2, 'bday', 'Fiesta Birthday Feast', 'Birthday', 'gift-outline', 380.00, 30, 'Festive buffet spread for every age', 4.70, 'Best Value', 'https://images.unsplash.com/photo-1489710020360-66e504159b43?w=900&h=620&fit=crop&auto=format', 1),
(3, 'corp', 'Boardroom Banquet', 'Corporate', 'briefcase-outline', 420.00, 20, 'Polished catering for meetings and launches', 4.80, 'Fast Setup', 'https://images.unsplash.com/photo-1672826979217-7156a305acf5?w=900&h=620&fit=crop&auto=format', 1),
(4, 'debut', 'Grand Debut Celebration', 'Debut', 'rose-outline', 550.00, 50, '18 roses and candles-ready banquet', 4.90, 'Trending', 'https://images.unsplash.com/photo-1682139710760-6d7689af543b?w=900&h=620&fit=crop&auto=format', 1),
(5, 'basic', 'Everyday Buffet', 'Basic', 'restaurant-outline', 250.00, 20, 'Simple, reliable buffet for any gathering', 4.60, 'Budget Pick', 'https://images.unsplash.com/photo-1536489885071-87983c3e2859?w=900&h=620&fit=crop&auto=format', 1);

-- 6. Insert Package Inclusions
INSERT INTO package_inclusions (package_id, item_text, sort_order) VALUES
(1, '5-course plated or buffet service', 1),
(1, 'Elegant table and backdrop styling', 2),
(1, 'Dedicated event coordinator', 3),
(1, 'Complimentary tasting for two', 4),

(2, 'Buffet-style service, 6 dishes', 1),
(2, 'Themed table setup', 2),
(2, 'Free birthday cake (1kg)', 3),
(2, 'Loot bags for kids parties', 4),

(3, 'Plated or packed lunch options', 1),
(3, 'Coffee and tea station all-day', 2),
(3, 'Uniformed service staff', 3),
(3, 'On-time delivery guarantee', 4),

(4, '7-course buffet service', 1),
(4, 'Cocktail table styling', 2),
(4, 'Dessert bar station', 3),
(4, 'Reserved table for the celebrant', 4),

(5, '4 main dishes + rice + dessert', 1),
(5, 'Disposable service ware', 2),
(5, 'Delivery within Bohol', 3);

-- 7. Insert Add-ons
INSERT INTO addons (id, code, name, price, unit_type, icon, image_url, is_active) VALUES
(1, 'lechon', 'Whole Lechon', 9500.00, 'flat', 'flame-outline', 'https://images.unsplash.com/photo-1722290171775-3e417486279f?w=700&h=360&fit=crop&auto=format', 1),
(2, 'dessert', 'Dessert Station', 4500.00, 'flat', 'ice-cream-outline', 'https://images.unsplash.com/photo-1637264596042-fcf205a81e1e?w=700&h=360&fit=crop&auto=format', 1),
(3, 'photo', 'Photobooth Setup', 6000.00, 'flat', 'camera-outline', 'https://images.unsplash.com/photo-1624724698435-1f6ca7ebb0ec?w=700&h=360&fit=crop&auto=format', 1),
(4, 'drinks', 'Softdrinks Station', 1500.00, 'flat', 'cafe-outline', 'https://images.unsplash.com/photo-1766270122919-9453e6ae8bd6?w=700&h=360&fit=crop&auto=format', 1),
(5, 'projector', 'Projector and Screen', 3500.00, 'flat', 'easel-outline', 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?w=700&h=360&fit=crop&auto=format', 1),
(6, 'coffee', 'All-Day Coffee and Tea', 2500.00, 'flat', 'cafe-outline', 'https://images.unsplash.com/photo-1775146089167-46ed2a2c3d04?w=700&h=360&fit=crop&auto=format', 1),
(7, 'lunchbox', 'Premium Exec Lunch Box', 350.00, 'per_head', 'cube-outline', 'https://images.unsplash.com/photo-1536489885071-87983c3e2859?w=700&h=360&fit=crop&auto=format', 1),
(8, 'roses', '18 Roses Arrangement', 3500.00, 'flat', 'rose-outline', 'https://images.unsplash.com/photo-1548094967-e25a127d1f6d?w=700&h=360&fit=crop&auto=format', 1),
(9, 'video', 'Same-Day Edit Video', 9500.00, 'flat', 'videocam-outline', 'https://images.unsplash.com/photo-1629756048377-09540f52caa1?w=700&h=360&fit=crop&auto=format', 1),
(10, 'extra', 'Extra Main Dish', 800.00, 'flat', 'fast-food-outline', 'https://images.unsplash.com/photo-1570275239925-4af0aa93a0dc?w=700&h=360&fit=crop&auto=format', 1),
(11, 'rice', 'Extra Rice (50 cups)', 600.00, 'flat', 'restaurant-outline', 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=700&h=360&fit=crop&auto=format', 1);

-- 8. Link Packages to Addons
-- Wedding (wed -> 1)
INSERT INTO package_addon_links (package_id, addon_id) VALUES (1, 1), (1, 2), (1, 3);
-- Birthday (bday -> 2)
INSERT INTO package_addon_links (package_id, addon_id) VALUES (2, 2), (2, 4);
-- Corporate (corp -> 3)
INSERT INTO package_addon_links (package_id, addon_id) VALUES (3, 5), (3, 6), (3, 7);
-- Debut (debut -> 4)
INSERT INTO package_addon_links (package_id, addon_id) VALUES (4, 8), (4, 9);
-- Basic (basic -> 5)
INSERT INTO package_addon_links (package_id, addon_id) VALUES (5, 10), (5, 11);

-- 9. Insert Bookings
INSERT INTO bookings (id, booking_reference, customer_id, package_id, event_name, event_date, event_time, venue_name, venue_address, guest_count, package_subtotal, addons_subtotal, total_amount, deposit_amount, balance_amount, status, created_at) VALUES
(1, 'ZFC-208114', 1, 3, 'Boardroom Executive Meeting', '2026-07-22', '12:00:00', 'Tagbilaran City Hall', 'Tagbilaran City, Bohol', 40, 16800.00, 0.00, 16800.00, 8400.00, 8400.00, 'served', '2026-07-15 09:00:00'),
(2, 'ZFC-208219', 1, 2, 'Fiesta Birthday Celebration', '2026-08-30', '18:00:00', 'Community Center', 'Brgy. Cogon, Tagbilaran City, Bohol', 45, 17100.00, 4500.00, 21600.00, 10800.00, 10800.00, 'delivery', '2026-08-22 09:00:00'),
(3, 'ZFC-759084', 2, 2, 'Grand Birthday Feast', '2026-09-18', '18:00:00', 'Bohol Tropics Resort', 'Tagbilaran City, Bohol', 80, 30400.00, 15000.00, 45400.00, 22700.00, 22700.00, 'confirmed', '2026-09-06 04:47:19');

-- 10. Insert Booking Addons
INSERT INTO booking_addons (booking_id, addon_id, quantity, unit_price, line_total) VALUES
(2, 2, 1, 4500.00, 4500.00),
(3, 2, 3, 4500.00, 13500.00),
(3, 4, 1, 1500.00, 1500.00);

-- 11. Insert Payments
INSERT INTO payments (booking_id, payment_type, payment_method, amount, reference_number, status, verified_by_user_id, payment_date) VALUES
(1, 'deposit', 'Bank Transfer', 8400.00, 'BDO-TRX-998822', 'verified', 1, '2026-07-15 09:15:00'),
(1, 'balance', 'Cash on Delivery', 8400.00, 'CASH-REC-0012', 'verified', 1, '2026-07-22 12:30:00'),
(2, 'deposit', 'GCash', 10800.00, 'GCASH-90928374', 'verified', 1, '2026-08-22 09:30:00'),
(3, 'deposit', 'Cash on Delivery', 22700.00, 'COD-PENDING', 'pending', NULL, '2026-09-06 04:47:19');

-- 12. Insert Staff Assignments
INSERT INTO event_staff_assignments (booking_id, staff_profile_id, assigned_role, shift_start, shift_end, status, assigned_by_user_id) VALUES
(2, 1, 'Lead Chef', '2026-08-30 14:00:00', '2026-08-30 21:00:00', 'confirmed', 1),
(2, 2, 'On-Site Coordinator', '2026-08-30 16:00:00', '2026-08-30 22:00:00', 'confirmed', 1),
(2, 3, 'Service Crew Lead', '2026-08-30 16:30:00', '2026-08-30 22:00:00', 'confirmed', 1),
(3, 1, 'Lead Chef', '2026-09-18 13:00:00', '2026-09-18 21:00:00', 'assigned', 1),
(3, 2, 'Lead Coordinator', '2026-09-18 15:00:00', '2026-09-18 22:00:00', 'assigned', 1);

-- 13. Insert Event Tasks (Staff Checklist)
INSERT INTO event_tasks (booking_id, staff_profile_id, title, stage, status, due_time) VALUES
(2, 1, 'Prepare 6 main buffet dishes & dessert', 'preparing', 'completed', '15:00:00'),
(2, 1, 'Pack in insulated thermal food containers', 'ready', 'completed', '17:00:00'),
(2, 3, 'Transport to Brgy. Cogon venue', 'delivery', 'in_progress', '17:30:00'),
(2, 3, 'Setup skirted buffet table and food warmers', 'delivery', 'pending', '17:50:00'),
(2, 3, 'Complete buffet service & dish replenishment', 'served', 'pending', '20:30:00'),
(3, 1, 'Procure fresh ingredients for 80 guests', 'preparing', 'pending', '12:00:00'),
(3, 1, 'Prepare dessert station (3 units)', 'preparing', 'pending', '15:00:00'),
(3, 2, 'Coordinate venue access at Bohol Tropics', 'preparing', 'pending', '14:00:00');

-- 14. Insert Reviews & Feedback
INSERT INTO reviews_feedback (booking_id, customer_id, rating, comment, created_at) VALUES
(1, 1, 5, 'The food was served hot and on time. The staff were very polite and accommodating. Highly recommended!', '2026-07-23 10:30:00');

-- 15. Insert Contact Inquiries
INSERT INTO contact_inquiries (name, email, phone, message, status, created_at) VALUES
('Grace Lim', 'grace.lim@gmail.com', '+63 920 123 7890', 'Inquiring for wedding catering in Panglao next November. Can you customize the menu?', 'unread', '2026-09-08 14:20:00'),
('Mark Villanueva', 'mark.v@yahoo.com', '+63 917 888 3322', 'Do you provide sound system and lights with the corporate package?', 'read', '2026-09-05 11:10:00');
